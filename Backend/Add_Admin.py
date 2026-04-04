import requests
import sqlite3
import os
import sys


def main():
    username = input("Username: ").strip()
    email = input("Email: ").strip().lower()
    password = input("Password: ").strip()

    if not username or not email or not password:
        print("Todos los campos son requeridos.")
        sys.exit(1)

    base_url = "http://localhost:8000"

    print(f"\nRegistrando usuario {username} ({email})...")

    try:
        response = requests.post(
            f"{base_url}/auth/register",
            json={"username": username, "email": email, "password": password},
            timeout=10
        )

        if response.status_code == 409:
            print("El usuario ya existe, intentando actualizar password...")
        elif response.status_code >= 400:
            print(f"Error en registro: {response.status_code} - {response.text}")
            sys.exit(1)
        else:
            print("Usuario registrado exitosamente via API.")
    except requests.exceptions.ConnectionError:
        print("No se pudo conectar al API.")
        print("El usuario no fue registrado. Por favor inicia el servidor API e intenta de nuevo.")
        sys.exit(1)

    db_path = os.path.join(os.path.dirname(__file__), "skillswap.db")
    if not os.path.exists(db_path):
        print(f"Base de datos no encontrada en: {db_path}")
        sys.exit(1)

    print(f"Actualizando rol a superadmin en la base de datos ({db_path})...")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute(f"UPDATE usuarios SET role = 'superadmin' WHERE email = '{email}'")
    conn.commit()

    if cursor.rowcount == 0:
        print("No se encontró ningún usuario con ese email.")
        conn.close()
        sys.exit(1)

    conn.close()

    print(f"\nUsuario '{username}' creado exitosamente con rol 'superadmin'.")


if __name__ == "__main__":
    main()
