"""
XMPP Client Implementation using Slixmpp
This script implements an XMPP client that connects to an XMPP server, handles 
authentication, sends presence, and processes incoming messages.
For more information on Slixmpp, visit: 
https://slixmpp.readthedocs.io/en/latest/index.html
"""
import slixmpp
class XMPPClient(slixmpp.ClientXMPP):
    """
    XMPPClient class that inherits from slixmpp.ClientXMPP.
    This class represents an XMPP client for connecting to an XMPP server,
    handling authentication, sending presence, and processing incoming messages.
    """
    def __init__(self, jid, password):
        """
        Initializes the XMPPClient with JID and password.
        Args:
            jid (str): The Jabber ID (JID) for the user.
            password (str): The password for the user.
        """
        super().__init__(jid, password)
        self.authenticated = False  # Flag to track authentication status
        self.add_event_handler("session_start", self.session_start)
        self.add_event_handler("message", self.message)
        self.add_event_handler("session_bind", self.bind_success)
        self.add_event_handler("failed_auth", self.auth_failure)

    def session_start(self, event):
        """
        Handler for the 'session_start' event.
        This method is called when the session starts, sends presence,
        retrieves the roster, and updates the authentication status.
        """
        self.send_presence()  # Send presence to the XMPP server
        self.get_roster()  # Get the roster (list of contacts)
        self.authenticated = True  # Set flag to true on successful login
        print("Login successful!")

    def message(self, msg):
        """
        Handler for incoming messages.
        Args:
            msg (slixmpp.Message): The incoming message object containing
            the sender's JID and message body.
        """
        print(f"Message from {msg['from']}: {msg['body']}")
        
    def bind_success(self, event):
        """
        Handler for successful session binding.
        This method is called when the client successfully binds to the
        XMPP server and prints a confirmation message.
        """
        print("Successfully bound to the XMPP server.")
    def auth_failure(self, event):
        """
        Handler for authentication failure.
        This method is called when authentication fails, printing an error
        message and disconnecting from the server.
        """
        print("Login failed: Incorrect JID or password.")
        self.disconnect() 
    def login(self):
        """
        Connects to the XMPP server and starts the event loop.
        This method attempts to connect to the XMPP server and processes events
        until disconnected or an error occurs.
        """
        try:
            self.connect(address=("alumchat.lol", 7070), disable_starttls=True)
            self.process(forever=False)  # Start the event loop
        except Exception as e:
            print(f"Error during login: {e}")

    def logout(self):
        """
        Logs out from the XMPP server.
        This method disconnects the client and prints a logout confirmation.
        """
        self.send_presence(ptype='unavailable')  # Send unavailable presence
        self.disconnect()  # Disconnect from the server
        print("Logged out successfully.")

# Create a function to initialize and run the client
def run_client(jid, password):
    """
    Initializes and runs the XMPP client.
    Args:
        jid (str): The Jabber ID (JID) for the user.
        password (str): The password for the user.
    """
    client = XMPPClient(jid, password)
    client.login()  # Call the login method to connect and start the loop
if __name__ == "__main__":
    # Replace with your JID and password
    jid = input("Enter your JID: ")  # Prompt user for JID
    password = input("Enter your password: ")  # Prompt user for password
    run_client(jid, password)  # Run the XMPP client with provided credentials