# link-state-routing

## Installation and Setup
To run this XMPP client locally, ensure that you have Node.js and npm installed on your machine. Follow the steps below to set up the project:

1. Download or clone the project directory to your local machine.
2. Navigate to the root of the project directory and run the following command to install the necessary dependencies listed in `package.json`:

```
npm install
```

3. As this is a client that lives exclusively withing a CLI, run the main script `main.js` with Node.js:

```
node main.js
```

## Usage

1. Upon starting the client, you will be prompted to input a letter, which represents the JID displayed on screen. This will be the account with which you log in to the server. You can modify these users by altering the `names.txt` file.
2. Enter the account's password to start the client and log in.
3. The client will begin comunicating with its neighbors automatically. After a while, the routing table for the network will be complete.
### User Actions
- You may **send a message** to another user, accessible by inputing `1` after the client has successfully flooded the network.
- You may **resend echoes** to your neighbors by inputing `2`, which will update your Round Trip Time to them, although this is not necesssary.
- You may **disable routing logs**, accessible by inputing `3`.
- To **close** the client, input `4`.
