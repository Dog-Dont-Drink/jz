import hashlib
import os
import secrets


def hash_password(password: str, salt: str) -> str:
  pw = (password or "").encode("utf-8")
  s = bytes.fromhex(salt)
  dk = hashlib.pbkdf2_hmac("sha256", pw, s, 120_000)
  return dk.hex()


def new_salt() -> str:
  return secrets.token_bytes(16).hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
  return hash_password(password, salt) == (expected_hash or "")

