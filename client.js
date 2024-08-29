const { client, xml } = require('@xmpp/client');
const debug = require('@xmpp/debug');
const { dijkstra } = require('./LSR');

let XMPPclient;
let echoTimes = {};
let knownTimes = {};
let routingTable = {};
let logs = true;

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

		knownTimes[names['config'][currentNode]] = {};

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

		}, 2000)

	});

	XMPPclient.on('stanza', async (stanza) => {
        if (stanza.is('message') && stanza.getChildText('type') === 'echo') {
            const fromNode = stanza.attrs.from.split('/')[0];
            const hops = stanza.getChildText('hops');

            if (hops === '1') {
                XMPPclient.send(
                    xml('message', { 'to': fromNode },
                        xml('type', {}, 'echo'),
                        xml('body', {}, stanza.getChild('body').text()),
                        xml('hops', {}, '2')
                    )
                );

				if (!knownTimes[names['config'][currentNode]][fromNode]) {
					const timestamp = Date.now();
					echoTimes[fromNode] = timestamp;
		
					XMPPclient.send(
						xml('message', { 'type': 'normal', 'to': fromNode },
							xml('type', {}, 'echo'),
							xml('body', {}, 'echo'),
							xml('hops', {}, '1')
						)
					);
				}

            } else if (hops === '2') {
                const sentTime = echoTimes[fromNode];
                if (sentTime) {
                    const roundTripTime = Date.now() - sentTime;
                    console.log(`Round-trip time to ${fromNode}: ${roundTripTime} ms`);
                    delete echoTimes[fromNode];

                    if (!knownTimes[names['config'][currentNode]]) {
                        knownTimes[names['config'][currentNode]] = {};
                    }

                    knownTimes[names['config'][currentNode]][fromNode] = roundTripTime;

					startFlood(XMPPclient, topo['config'][currentNode].map(node => {
						return names['config'][node]
					}));

                }
            }
        } 
		else if (stanza.is('message') && stanza.getChildText('type') === 'info') {
            const receivedTimes = JSON.parse(stanza.getChild('table').getText());

            mergeKnownTimes(receivedTimes, names['config'][currentNode]);

			if (!stanza.getChild('headers')) {

				propagateFlood(XMPPclient, stanza, topo['config'][currentNode].map(node => {
					return names['config'][node];
				}));

				XMPPclient.send(
					xml('message', { to: stanza.attrs.from.split('/')[0] },
						xml('type', {}, 'info'),
						xml('headers', {}, ['no-flood']),
						xml('table', {}, 
							JSON.stringify(knownTimes)
						),
						xml('hops', {}, 1)
					)
				)

			}

        } 
		else if (stanza.is('message') && stanza.attrs.type === 'chat') {
			//console.log(stanza)
			const message = JSON.parse(stanza.getChildText('body'));

			if (message.to === `${XMPPclient.jid._local}@alumchat.lol`) {
				console.log(`\nMESSAGE RECEIVED FROM ${message.from} AFTER ${message.hops} HOPS: ${message.payload}\n`)
			} 
			else {
				if (routingTable[message.to]){
					const nextHop = routingTable[message.to]['nextHop'];
					console.log(`\nFORWARDING MESSAGE FROM ${stanza.attrs.from.split('/')[0]} TO ${nextHop}\n`);
					XMPPclient.send(xml('message', { to: nextHop, type: 'chat' }, 
						xml('body', {}, JSON.stringify({
							type: 'message',
							from: message.from,
							to: message.to,
							headers: message.headers,
							hops: parseInt(message.hops) + 1,
							payload: message.payload,
						})))
					);
				}
			}
		}
    });

	XMPPclient.on('error', (err) => {
		console.error('ERROR', err);
	});

	XMPPclient.on('offline', () => {
		console.log('Disconnected');
	});

	XMPPclient.start().catch(console.error);

	return XMPPclient;
}

const startFlood = (client, neighbors) => {
	//console.log('STARTING FLOOD')
	neighbors.forEach(neighbor => {
		client.send(
			xml('message', { to: neighbor },
				xml('type', {}, 'info'),
				xml('table', {}, 
					JSON.stringify(knownTimes)
				),
				xml('visited', {}, 
					neighbors.map(element => xml('node', { name: element }))
				),
				xml('hops', {}, 1)
			)
		)
	});
};

const propagateFlood = (client, floodMsg, neighbors) => {

	//console.log('PROPAGATING FLOOD')
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
					),
					xml('hops', {}, parseInt(floodMsg.getChildText('hops')) + 1)
				)
			)
		}
	});
};

const mergeKnownTimes = async (receivedTimes, source) => {
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

	//console.log('MERGE RESULT')
	//console.log(knownTimes);

	routingTable = await dijkstra(knownTimes, source);

	if (logs) {
		console.log('UPDATED ROUTING TABLE');
		console.log(routingTable);
	}
	
};

const sendMessage = (client, to, payload) => {
	const nextHop = routingTable[`${to}@alumchat.lol`]['nextHop'];
	client.send(xml('message', { to: nextHop, type: 'chat' }, 
		xml('body', {}, JSON.stringify({
			type: 'message',
			from: `${client.jid._local}@alumchat.lol`,
			to: `${to}@alumchat.lol`,
			headers: [],
			hops: 1,
			payload: payload,
		})))
	);
};

const resendEchoes = (client, names, topo, currentNode) => {

	topo['config'][currentNode].forEach(element => {

		const timestamp = Date.now();
		echoTimes[names['config'][element]] = timestamp;

		client.send(
			xml('message', { 'type': 'normal', 'to': names['config'][element] },
				xml('type', {}, 'echo'),
				xml('body', {}, 'echo'),
				xml('hops', {}, '1')
			)
		)
	});

}

const toggleLogs = (newValue) => {
	logs = newValue;
}

module.exports = { login, sendMessage, resendEchoes, toggleLogs };
