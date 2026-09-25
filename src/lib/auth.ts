// src/lib/auth.ts
import { supabase } from "./supabase";
import { User } from "@/types";
import { validatePassword } from "./password";

export interface AuthResponse {
  user: User | null;
  error: string | null;
}

/**
 * Sign in with Google OAuth (Redirect method)
 */
export async function loginGoogle(): Promise<AuthResponse> {
  try {
    const redirectUrl = `${window.location.origin}/challenges`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }
    return { user: null, error: null };
  } catch (error) {
    return { user: null, error: "Google sign-in failed" };
  }
}

/**
 * Sign in with Google ID Token (Google Identity Services - Murni Domain ctfpolije.my.id tanpa redirect supabase)
 */
export async function loginGoogleWithIdToken(
  idToken: string
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) {
      return { user: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, error: "Google sign-in did not return user" };
    }

    return { user: data.user as any, error: null };
  } catch (error: any) {
    return { user: null, error: error?.message || "Google sign-in failed" };
  }
}

/**
 * Sign in with GitHub OAuth
 */
export async function loginGithub(): Promise<AuthResponse> {
  try {
    const redirectUrl = `${window.location.origin}/challenges`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (error) {
      return { user: null, error: error.message };
    }
    return { user: null, error: null };
  } catch (error) {
    return { user: null, error: "GitHub sign-in failed" };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(
  email: string,
  turnstileToken?: string,
): Promise<{ error: string | null }> {
  try {
    if (turnstileToken) {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstile_token: turnstileToken }),
      });
      const data = await response.json().catch(() => ({}));
      return response.ok
        ? { error: null }
        : { error: data?.message ?? "Failed to send reset email" };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/challenges`,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    return { error: "Failed to send reset email" };
  }
}

/**
 * Update current user's password
 */
export async function updatePassword(
  newPassword: string
): Promise<{ error: string | null }> {
  try {
    const passwordError = validatePassword(newPassword);
    if (passwordError) return { error: passwordError };

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return { error: "User not authenticated" };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  } catch (error) {
    return { error: "Failed to update password" };
  }
}

/**
 * Register a new user
 * - Cek allowed email domain (client)
 * - Kirim ke /api/register untuk cek team token (server)
 */
export async function signUp(
  email: string,
  password: string,
  username: string,
  teamToken: string,
  turnstileToken?: string,
): Promise<AuthResponse> {
  try {
    // ✅ allowed domain (seperti sebelumnya)
    const allowedDomains = [
      "@gmail.com",
      "@student.polije.ac.id",
      "@polije.ac.id",
    ];
    const lowerEmail = email.toLowerCase();
    const allowed = allowedDomains.some((d) => lowerEmail.endsWith(d));

    if (!allowed) {
      return {
        user: null,
        error: "Email is not allowed",
      };
    }

    // ✅ panggil API /api/register (server yang cek REGISTER_TOKEN & bikin akun)
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        username,
        team_token: teamToken,
        turnstile_token: turnstileToken,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        user: null,
        error: data?.message ?? "Registration failed",
      };
    }

    // optional: auto-login setelah register
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData.user) {
      // akun sudah kepake, tapi auto login gagal → biarin, user login manual
      return { user: null, error: null };
    }

    // ambil profile dari public.users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", signInData.user.id)
      .single();

    if (userError || !userData) {
      return { user: null, error: null };
    }

    return { user: userData, error: null };
  } catch (error) {
    console.error("signUp error:", error);
    return { user: null, error: "Registration failed" };
  }
}

/**
 * Login (email atau username)
 */
export async function signIn(
  identifier: string,
  password: string,
  turnstileToken?: string,
): Promise<AuthResponse> {
  try {
    let authUser;

    if (turnstileToken) {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          turnstile_token: turnstileToken,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.session) {
        return { user: null, error: result?.message ?? "Login failed" };
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession(result.session);
      if (sessionError || !sessionData.user) {
        return { user: null, error: sessionError?.message ?? "Login failed" };
      }
      authUser = sessionData.user;
    } else {
      let email = identifier;

      // Kalau bukan email → anggap username, ambil email via RPC
      if (!identifier.includes("@")) {
        const { data: rpcEmail, error: rpcError } = await supabase.rpc(
          "get_email_by_username",
          {
            p_username: identifier,
          }
        );

        if (rpcError || !rpcEmail) {
          return { user: null, error: "User not found" };
        }

        email = rpcEmail;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      authUser = data.user;
    }

    if (!authUser) {
      return { user: null, error: "Login failed" };
    }

    // Ambil dari public.users
    let { data: userData, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (userError || !userData) {
      // Auto-create profile kalau belum ada
      const username =
        authUser.user_metadata?.username ??
        (authUser.email
          ? authUser.email.split("@")[0]
          : "user_" + authUser.id.substring(0, 8));

      const { error: rpcError } = await supabase.rpc("create_profile", {
        p_id: authUser.id,
        p_username: username,
      });

      if (rpcError) {
        console.error("Auto create_profile error:", rpcError);
        return { user: null, error: "Failed to create user profile" };
      }

      const { data: newUserData, error: newUserError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (newUserError) {
        return { user: null, error: newUserError.message };
      }

      userData = newUserData;
    }

    return { user: userData, error: null };
  } catch (error) {
    return { user: null, error: "Login failed" };
  }
}

let cachedCurrentUser: { user: User | null; timestamp: number } | null = null;
let currentUserInFlight: Promise<User | null> | null = null;
const AUTH_CACHE_TTL = 45000; // 45 detik cache in-memory

export function invalidateAuthCache(): void {
  cachedCurrentUser = null;
}

/**
 * Sign out user
 */
export async function signOut(): Promise<void> {
  invalidateAuthCache();
  await supabase.auth.signOut();
}

/**
 * Get current user
 */
export async function getCurrentUser(forceRefresh = false): Promise<User | null> {
  if (!forceRefresh && cachedCurrentUser && Date.now() - cachedCurrentUser.timestamp < AUTH_CACHE_TTL) {
    return cachedCurrentUser.user;
  }

  if (currentUserInFlight) {
    return currentUserInFlight;
  }

  currentUserInFlight = (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        cachedCurrentUser = { user: null, timestamp: Date.now() };
        return null;
      }

      // Fetch user profile via RPC dan is_admin secara paralel
      const [profileRes, adminRes] = await Promise.all([
        supabase.rpc("get_user_profile", { p_id: user.id }),
        supabase.rpc("is_admin"),
      ]);
      let userData = profileRes.data && profileRes.data.length > 0 ? profileRes.data[0] : null;
      const rpcIsAdmin = Boolean(adminRes?.data);

      // Kalau belum ada profile (misal Google login pertama kali) → buat
      if (!userData) {
        const username =
          user.user_metadata?.username ||
          (user.email
            ? user.email.split("@")[0]
            : "user_" + user.id.substring(0, 8));

        const { error: rpcError } = await supabase.rpc("create_profile", {
          p_id: user.id,
          p_username: username,
        });
        if (rpcError) {
          console.error("Auto create_profile error:", rpcError);
          return null;
        }
        const { data: newData, error: newError } = await supabase.rpc(
          "get_user_profile",
          { p_id: user.id }
        );
        userData = newData && newData.length > 0 ? newData[0] : null;
        if (newError || !userData) {
          return null;
        }
      }

      if (userData) {
        const isActuallyAdmin = Boolean(
          userData.is_admin === true || 
          userData.role === 'admin' || 
          rpcIsAdmin
        );
        const role = isActuallyAdmin 
          ? 'admin' 
          : (userData.role === 'contributor' ? 'contributor' : 'user');
        userData.role = role;
        userData.is_admin = isActuallyAdmin;
        userData.is_contributor = !isActuallyAdmin && role === 'contributor';
      }

      cachedCurrentUser = { user: userData, timestamp: Date.now() };
      return userData;
    } catch (error) {
      return null;
    } finally {
      currentUserInFlight = null;
    }
  })();

  return currentUserInFlight;
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  // Fast path jika sudah terkonfirmasi admin dari cache
  if (cachedCurrentUser?.user && (cachedCurrentUser.user.is_admin || cachedCurrentUser.user.role === 'admin')) {
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (user && (user.is_admin || user.role === 'admin')) return true;
    const { data, error } = await supabase.rpc("is_admin");
    if (error) {
      return Boolean(user?.is_admin || user?.role === 'admin');
    }
    const result = Boolean(data);
    if (cachedCurrentUser?.user) {
      cachedCurrentUser.user.is_admin = result;
      if (result) cachedCurrentUser.user.role = 'admin';
    }
    return result;
  } catch (error) {
    return false;
  }
}

/**
 * Check if current user is contributor (strictly not admin)
 */
export async function isContributor(): Promise<boolean> {
  if (cachedCurrentUser?.user) {
    const u = cachedCurrentUser.user;
    if (u.is_admin || u.role === 'admin') return false;
    return u.role === 'contributor' || u.is_contributor === true;
  }

  try {
    const user = await getCurrentUser();
    if (!user) return false;
    if (user.is_admin || user.role === 'admin') return false;
    return user.role === 'contributor' || user.is_contributor === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get role of current user
 */
export async function getUserRole(): Promise<'admin' | 'contributor' | 'user'> {
  if (cachedCurrentUser?.user) {
    const u = cachedCurrentUser.user;
    if (u.is_admin || u.role === 'admin') return 'admin';
    if (u.role === 'contributor') return 'contributor';
    return 'user';
  }

  try {
    const user = await getCurrentUser();
    if (!user) return 'user';
    if (user.is_admin || user.role === 'admin') return 'admin';
    if (user.role === 'contributor') return 'contributor';
    return 'user';
  } catch {
    return 'user';
  }
}
