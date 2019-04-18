const request = require('request');
const config = require('config');

const user = process.env.USER || config.get('publicKey');
const apiKey = process.env.API_KEY || config.get('privateKey');
const apiUrl = config.get('baseUrl');
const tag = config.get('tag');

const option = {

    auth: {

        user: user,
        pass: apiKey,
        sendImmediately: false
    },
    headers: {

        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};

removeIps(tag);

async function removeIps(tag) {

    try {

        let counter = 0;
        const ips = await getIpsByTag(tag);
        console.log(`${ips.length} matching record found.`);

        if (ips.length) {

            remove();
        }

        function remove() {

            const ip = ips[counter++].cidrBlock;
            const url = `${apiUrl}/${ip.replace('/', '%2F')}`;

            request.delete(url, option, error => {

                if (!error) {

                    console.log(`removed ${ip} from whitelist.`);
                }

                if (counter < ips.length) {

                    setTimeout(remove, 1000);
                }
            });
        };
    }
    catch (error) {

        console.log('failed to remove existing IPs.');
    }
}

async function getIpsByTag(tag) {

    const allIps = await getExistingIps();

    return allIps.filter(_ => {

        return _.comment && _.comment.toLowerCase() === tag.toLowerCase();
    });
}

async function getExistingIps() {

    const url = `${apiUrl}?itemsPerPage=500`;

    return await new Promise(resolve => {

        request.get(url, option, (error, response, body) => {

            const hasIps = !error && response.statusCode === 200;
            resolve(hasIps ? JSON.parse(body).results : []);
        });
    });
}
