import sys
import json
import struct
import os
import sqlite3
import base64
import secrets
from pathlib import Path
import time
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import traceback
def debug_log(text):
    # This writes a secret log file we can read!
    with open("C:\\Users\\U\\Coding\\Django\\NativeVault\\vault-host\\debug_log.txt", "a") as f:
        f.write(str(text) + "\n")


app_data_path=Path(os.getenv("APPDATA"))/"NativeVault"
app_data_path.mkdir(parents=True, exist_ok=True)

db_path=app_data_path/"vault.db"
key_path=app_data_path/"master.key"

def get_or_create_ket():
    if key_path.exists():
        with open(key_path,"rb") as f:
            return f.read()
    else:
        key=AESGCM.generate_key(bit_length=256)
        with open(key_path,"wb") as f:
            f.write(key)
        return key
    
MASTER_KEY=get_or_create_ket()
aesgcm=AESGCM(MASTER_KEY)


def encrypt(text):
    if not text: return ""
    nonce=secrets.token_bytes(12)
    ciphertext=aesgcm.encrypt(nonce,text.encode('utf-8'),None)
    return base64.b64encode(nonce+ciphertext).decode('utf-8')

def decrypt(text):
    if not text: return ""
    try:
        data=base64.b64decode(text.encode('utf-8'))
        nonce=data[:12]
        ciphertext=data[12:]
        return aesgcm.decrypt(nonce,ciphertext,None).decode('utf-8')
    except Exception:
        return ""
    
def get_message():
    raw_length=sys.stdin.buffer.read(4)
    if len(raw_length)==0:
        sys.exit(0)
    message_length=struct.unpack('@I',raw_length)[0]
    message=sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)

def send_message(message_content):
    encoded_content=json.dumps(message_content).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I',len(encoded_content)))
    sys.stdout.buffer.write(encoded_content)
    sys.stdout.buffer.flush()
    time.sleep(0.05)


def main():
    conn=sqlite3.connect(db_path)
    c=conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS credentials(
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              url TEXT NOT NULL,
              username TEXT,
              password TEXT,
              UNIQUE(url,username)
              )
        ''')
    conn.commit()

    try:
            message=get_message()
            action =message.get("action")
            debug_log("--- Engine Started ---")
        
            debug_log(f"Raw message received from Chrome: {message}")
            
            if not message:
                debug_log("Message was empty. Exiting.")
                return
                
            action = message.get("action")
            debug_log(f"Action requested: {action}")

            if action == "get_all":
                debug_log("Entering get_all block (Isolation Test)...")
            # (Make sure this variable matches your database cursor, usually 'cursor' or 'c')
                c.execute("SELECT id, url, username, password FROM credentials")
                rows = c.fetchall()
                
                vault_data = []
                for row in rows:
                    decrypted_pw = ""
                    try:
                        # Try to decrypt the password
                        decrypted_pw = decrypt(row[3]) 
                    except Exception:
                        # If it fails (because it's old plain-text test data), don't crash!
                        decrypted_pw = "[Old Unencrypted Data]"
                    
                    vault_data.append({
                        "id": row[0],
                        "url": row[1],
                        "username": row[2],
                        "password": decrypted_pw
                    })
                
                send_message({"status": "success", "data": vault_data})
                
                

            elif action=="get_credenial":
                debug_log("get_credenial Isolation Test sent successfully!")
                url=message.get("payload",{}).get("url")
                c.execute("SELECT id, url, username, password FROM credentials WHERE url=?",(url,))
                rows=c.fetchall()
                if rows:
                    data_list=[]
                    for row in rows:
                        data_list.append({"id":row[0],"url":row[1],"username":row[2],"password":decrypt(row[3])})
                    send_message({"status":"success","data":data_list})
                else:
                    send_message({"status":"success","message":"Password Vault: No credentials found for this site."})
            elif action=='save_credential':
                url=message.get("payload",{}).get("url")
                username=message.get("payload",{}).get("username","")
                password=message.get("payload",{}).get("password","")

                c.execute('''
                    INSERT INTO credentials(url,username,password)
                    VAlUES(?,?,?)
                    ON CONFLICT(url,username) DO UPDATE SET
                    password=excluded.password
                ''',(url,username,encrypt(password)))
                conn.commit()
                send_message({"status":"success","message":"Saved successfully!"})

            elif action == "delete_credential":
            # Grab the ID sent from React and delete that specific row
                cred_id = message.get("payload", {}).get("id")
                c.execute("DELETE FROM credentials WHERE id = ?", (cred_id,))
                conn.commit()
                
                send_message({"status": "success", "message": "Deleted successfully."})
            else:
                send_message({"status":"success","message":"Unknown action"})

    except Exception as e:
            error_trace = traceback.format_exc()
            debug_log(f"CRASH TRACE:\n{error_trace}")
            send_message({"status":"error","message":f'An error occurred: {str(e)}'})
            sys.exit(1)


if __name__=='__main__':
    main()
                
