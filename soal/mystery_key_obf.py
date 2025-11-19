import zlib, base64

print(
    zlib.decompress(
        base64.b64decode(
            'eJxz83F0V7BVUArw9/H0cq32zy7JT0otig+K96tMjHcsSLSvVeIqSswsTlVwrUhOLSjJzM/TUPLLL0hV0uQCAEiqE3M='
        )
    ).decode()
)
