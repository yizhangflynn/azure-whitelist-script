const fs = require('fs');
const request = require('request');
const parser = require('xml2js').parseString;
const config = require('config');

const user = process.env.USER || config.get('publicKey');
const apiKey = process.env.API_KEY || config.get('privateKey');
const apiUrl = `${config.get('baseUrl')}?pretty=true`;
const tag = config.get('tag');
const xmlLink = config.get('xmlLink');
const output = config.get('outputFile');

generateCurlRequest(xmlLink, output, {

    regions: ['usnorth'],
    comment: tag,
    alive: 6//7
});

async function generateCurlRequest(url, output, option) {

    try {

        const { regions, comment, alive } = option;
        const ips = await getIpListByRegion(url, regions);
        const whitelist = getWhiteLists(ips, comment, alive);

        fs.writeFile(output, buildRequest(whitelist), error => {

            if (!error) {

                console.log(`saved request to file ${output}`);
            }
        });
    }
    catch (error) {

        console.log('failed to generate curl request.');
    }
}

function buildRequest(whitelist) {

    const request =
    `
        curl --user "${user}:${apiKey}" --digest --include \\
             --header "Accept: application/json" \\
             --header "Content-Type: application/json" \\
             --request POST ${apiUrl} \\
             --data '${JSON.stringify(whitelist)}'
    `;

    return request.trim();
}

function getWhiteLists(ips, comment, alive) {

    return ips.map(ip => ({

        ipAddress: ip,
        comment,
        deleteAfterDate: getDateFromNow(alive)
    }));
}

function getDateFromNow(days = 7) {

    const now = new Date();

    return new Date(now.setDate(now.getDate() + days));
}

async function getIpListByRegion(url, regions) {

    try {

        const xml = await fetchXml(url);
        const targets = new Set(regions.map(_ => _.toLowerCase()));
        const allRegions = xml.AzurePublicIpAddresses.Region;

        return allRegions
            .filter(_ => _.IpRange && targets.has(_.$.Name.toLowerCase()))
            .map(_ => _.IpRange.map(_ => _.$.Subnet))
            .reduce((result, current) => [...result, ...current], []);
    }
    catch (error) {

        return [];
    }
}

async function fetchXml(url) {

    return await new Promise(resolve => {

        request.get(url, (error, response, body) => {

            const hasResult = !error && response.statusCode === 200;
            resolve(hasResult ? parseXml(body) : '');
        });
    });
}

async function parseXml(xml) {

    return await new Promise(resolve => {

        parser(xml, (_, parsed) => {

            resolve(_ ? '' : parsed);
        });
    });
}
