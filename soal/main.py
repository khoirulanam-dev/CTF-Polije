import random

def gen_flag():
    random.seed(12345)
    charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    flag = "POLIJE{" + "".join(random.choice(charset) for _ in range(8)) + "}"
    return flag

def main():
    print("Access granted if you know the flag.")

if __name__ == "__main__":
    main()
