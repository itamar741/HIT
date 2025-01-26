

const readline = require('readline');
const net = require('net');


let client;

let isConnected = false;

const rl = readline.createInterface({

    input: process.stdin,

    output: process.stdout,

});



function connectToServer() {

    client = net.createConnection({ port: 12345 }, () => {

        isConnected = true;

        console.log('Connected to the server!');



        rl.question('Enter your name: ', (name) => {

            client.write(name.trim()); // Send the name to the server

            console.log(`You are now identified as "${name.trim()}"`);

            console.log('Type the name of the client you want to chat with:');

            rl.prompt();



            // Handle user input and send messages

            rl.on('line', (line) => {

                if (isConnected) {

                    client.write(line.trim());

                    rl.prompt();

                } else {

                    console.log('Cannot send message, disconnected from server.');

                }

            });

        });

    });



    // Handle messages from the server

    client.on('data', (data) => {

        console.log(data.toString().trim());

    });



    // Handle disconnection from the server

    client.on('end', () => {

        isConnected = false;

        console.log('Disconnected from the server. Attempting to reconnect...');

        setTimeout(connectToServer, 3000); // Retry connection after 3 seconds

    });



    // Handle errors

    client.on('error', (err) => {

        if (err.code === 'ECONNREFUSED') {

            console.log('Server is unavailable. Retrying connection...');

            setTimeout(connectToServer, 3000); // Retry connection after 3 seconds

        } else {

            console.error('Client error:', err.message);

        }

    });

}



// Start connection

connectToServer();