"""xorshift32 - identical to SeededRng in web/js/rng.js (for parity tests)."""


class DetRng:
    def __init__(self, seed=1):
        self.x = (seed & 0xFFFFFFFF) or 0x9E3779B9

    def random(self):
        x = self.x
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.x = x
        return x / 4294967296

    def randrange(self, n):
        return int(self.random() * n)

    def choice(self, a):
        return a[self.randrange(len(a))]

    def shuffle(self, a):
        for i in range(len(a) - 1, 0, -1):
            j = self.randrange(i + 1)
            a[i], a[j] = a[j], a[i]

    def sample(self, arr, k):
        pool = list(arr)
        for i in range(k):
            j = i + self.randrange(len(pool) - i)
            pool[i], pool[j] = pool[j], pool[i]
        return pool[:k]
