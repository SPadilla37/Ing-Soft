def canonical_match_pair(user_one_id: int, user_two_id: int) -> tuple[int, int]:
    return tuple(sorted([user_one_id, user_two_id]))
