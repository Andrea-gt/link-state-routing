const { client, xml } = require('@xmpp/client');
const debug = require('@xmpp/debug');

let XMPPclient;
let echoTimes = {};
let knownTimes = {};

const login = async (username, password, names, topo, currentNode) => {
	// Create a new XMPP client with the provided username and password
	XMPPclient = client({
		service: 'ws://alumchat.lol:7070/ws/',
		domain: 'alumchat.lol',
		username: username,
		password: password,
	});

	//debug(XMPPclient, true);

	XMPPclient.on('online', async (address) => {

		console.log(`Connected as ${address.toString()}`);

		XMPPclient.send(xml('presence'));

		setTimeout(() => {

			topo['config'][currentNode].forEach(element => {

				const timestamp = Date.now();
				echoTimes[names['config'][element]] = timestamp;
	
				XMPPclient.send(
					xml('message', { 'type': 'normal', 'to': names['config'][element] },
						xml('type', {}, 'echo'),
						xml('body', {}, 'echo'),
						xml('hops', {}, '1')
					)
				)
			});

		}, 15000)

	});

	XMPPclient.on('stanza', async (stanza) => {
        // Check if the stanza is an echo message
        if (stanza.is('message') && stanza.getChildText('type') === 'echo') {
            const fromNode = stanza.attrs.from.split('/')[0];
            const hops = stanza.getChildText('hops');

            if (hops === '1') {
                // Send the echo message back with hop count incremented
                XMPPclient.send(
                    xml('message', { 'to': fromNode },
                        xml('type', {}, 'echo'),
                        xml('body', {}, stanza.getChild('body').text()),
                        xml('hops', {}, '2')
                    )
                );
            } else if (hops === '2') {
                // Calculate the round-trip time
                const sentTime = echoTimes[fromNode];
                if (sentTime) {
                    const roundTripTime = Date.now() - sentTime;
                    console.log(`Round-trip time to ${fromNode}: ${roundTripTime} ms`);
                    delete echoTimes[fromNode];

                    // Initialize the entry for the current node if it doesn't exist
                    if (!knownTimes[names['config'][currentNode]]) {
                        knownTimes[names['config'][currentNode]] = {};
                    }

                    // Update the knownTimes object with the RTT
                    knownTimes[names['config'][currentNode]][fromNode] = roundTripTime;

					startFlood(XMPPclient, topo['config'][currentNode].map(node => {
						return names['config'][node]
					}));

                }
            }
        } else if (stanza.is('message') && stanza.getChildText('type') === 'info') {
            const receivedTimes = JSON.parse(stanza.getChild('table').getText());
            mergeKnownTimes(receivedTimes);
			propagateFlood(XMPPclient, stanza, topo['config'][currentNode].map(node => {
				return names['config'][node];
			}));
        }
    });

	XMPPclient.on('error', (err) => {
		console.error('ERROR', err);
	});

	XMPPclient.on('offline', () => {
		console.log('Disconnected');
	});

	XMPPclient.on('status', (status) => {
		console.log(`Status: ${status}`);
		if (status === 'disconnect') {
			console.log('Attempting to reconnect...');
			XMPPclient.start();
		}
	});

	XMPPclient.start().catch(console.error);

	return XMPPclient;
}

const startFlood = (client, neighbors) => {
	console.log('STARTING FLOOD')
	neighbors.forEach(neighbor => {
		client.send(
			xml('message', { to: neighbor },
				xml('type', {}, 'info'),
				xml('table', {}, 
					JSON.stringify(knownTimes)
				),
				xml('visited', {}, 
					neighbors.map(element => xml('node', { name: element }))
				)
			)
		)
	});
};

const propagateFlood = (client, floodMsg, neighbors) => {

	console.log('PROPAGATING FLOOD')
	let visited = floodMsg.getChild('visited').getChildren('node').map(entry => {
		return entry.attrs.name;
	})

	neighbors.forEach(neighbor => {
		if (!visited.includes(neighbor)) {
			let newVisited = [...visited, ...neighbors];
			client.send(
				xml('message', { to: neighbor, id: floodMsg.attrs.id },
					xml('type', {}, 'info'),
					xml('table', {}, 
						floodMsg.getChildText('table')
					),
					xml('visited', {}, 
						newVisited.map(element => xml('node', { name: element }))
					)
				)
			)
		}
	});
};

const mergeKnownTimes = (receivedTimes) => {
	for (const node in receivedTimes) {
		if (!knownTimes[node]) {
			knownTimes[node] = receivedTimes[node];
		} else {
			for (const target in receivedTimes[node]) {
				if (!knownTimes[node][target] || receivedTimes[node][target] < knownTimes[node][target]) {
					knownTimes[node][target] = receivedTimes[node][target];
				}
			}
		}
	}

	console.log('MERGE RESULT')
	console.log(knownTimes);

};

const sendEchoMessage = (client, to) => {
	const timestamp = Date.now();
	echoTimes[to] = timestamp;

	client.send(
		xml('message', { 'to': to },
			xml('type', {}, 'echo'),
			xml('body', {}, 'echo'),
			xml('hops', {}, '1')
		)
	);
}

module.exports = { login, sendEchoMessage };
