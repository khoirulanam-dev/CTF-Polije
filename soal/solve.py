# solve.py
def solve(path="ips.txt"):
    chars = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line: 
                continue
            ip, cidr = line.split("/")
            a_str = ip.split(".")[0]
            a = int(a_str)
            # /8 -> network = a.0.0.0, ambil oktet pertama a
            chars.append(chr(a))
    return "".join(chars)

if __name__ == "__main__":
    print(solve())  # print flag
