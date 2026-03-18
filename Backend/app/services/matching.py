def canonical_match_pair(user_one_id: str, user_two_id: str) -> tuple[str, str]:
    return tuple(sorted([user_one_id, user_two_id]))
