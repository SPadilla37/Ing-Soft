from typing import List


def average_rating(ratings: List[int]) -> float | None:
    if not ratings:
        return None
    return round(sum(ratings) / len(ratings), 2)
