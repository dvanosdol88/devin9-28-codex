

## WSL Troubleshooting Guide for the Teller App

This guide covers common issues encountered when setting up and running the Teller application on Windows Subsystem for Linux (WSL).

1. Python Environment Error
Problem: You see an error: externally-managed-environment when running pip install.

Reason: Your system is protecting the global Python installation. You need to be more explicit about using the virtual environment.

Solution: Instead of pip install, use the full path to the Python interpreter inside your virtual environment.

Bash

.venv/bin/python -m pip install -r python/requirements.txt
2. "Module Not Found" Error When Starting Server
Problem: The server fails to start with ModuleNotFoundError: No module named 'falcon'.

Reason: Your terminal is using the system's default Python, not the one from your virtual environment where the packages were installed.

Solution: Start the server using the full path to the virtual environment's Python interpreter.

Bash

# From the project's main directory
.venv/bin/python python/teller.py --environment sandbox
3. "Address already in use" Error
Problem: The server fails to start with OSError: [Errno 98] Address already in use.

Reason: A previous, crashed instance of the server is still occupying the port.

Solution: Find and stop the old process.

Find the Process ID (PID):

Bash

lsof -i :8001
Stop the Process (use the PID from the previous command):

Bash

kill <PID>
4. Certificate Error in Development Mode
Problem: The server crashes with OSError: Could not find the TLS certificate file, even with the correct path.

Reason: This is a known issue with WSL where some Python libraries have trouble accessing files on the Windows file system (e.g., paths starting with /mnt/d/).

Solution: Move the certificate files to a directory within the WSL file system itself.

Create a folder in your WSL home directory:

Bash

mkdir ~/certs
Move the certificates into that new folder:

Bash

# Make sure to use the correct filename (e.g., certificate.pem)
mv certificate.pem private_key.pem ~/certs/
Start the server using the new WSL-native path:

Bash

../.venv/bin/python teller.py --environment development --cert ~/certs/certificate.pem --cert-key ~/certs/private_key.pem






