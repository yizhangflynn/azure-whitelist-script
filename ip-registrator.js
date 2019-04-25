const request = require('request');
const parser = require('xml2js').parseString;
const config = require('config');

const user = process.env.USER || config.get('publicKey');
const apiKey = process.env.API_KEY || config.get('privateKey');
const region = process.env.REGION || 'usnorth';
const apiUrl = config.get('baseUrl');
const tag = config.get('tag');
const downloadPage = config.get('downloadPage');

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

populateIps(downloadPage, {

    regions: [region],
    comment: `${tag} for ${region}`,
    alive: 0
});

async function populateIps(url, whitelistOption) {

    const { regions, comment, alive } = whitelistOption;
    const resolvedLink = await resolveXmlLink(url);
    const ips = await getIpListByRegions(resolvedLink, regions);
    const body = JSON.stringify(getWhitelists(ips, comment, alive));
    const requestOption = Object.assign({ body }, option);

    request.post(apiUrl, requestOption, error => {

        if (!error) {

            console.log(`added ${ips.length} IPs to whitelist.`);
        }
    });
}

async function resolveXmlLink(url) {

    const content = await fetchFromUrl(url);
    const urls = content.match(/(?<=href=").+PublicIPs.+\.xml/g);

    if (!urls) {

        return '';
    }

    return urls[0];
}

function getWhitelists(ips, comment, alive = 0) {

    if (!alive) {

        alive = getRemainingDaysInWeek();
    }

    return ips.map(ip => ({

        ipAddress: ip,
        comment,
        deleteAfterDate: getDateFromNow(alive)
    }));
}

function getRemainingDaysInWeek() {

    const today = new Date().getDay();

    return today ? 7 - today : 0;
}

function getDateFromNow(days = 7) {

    const now = new Date();

    return new Date(now.setDate(now.getDate() + days));
}

async function getIpListByRegions(url, regions) {

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

async function fetchFromUrl(url) {

    return await new Promise(resolve => {

        request.get(url, (error, response, body) => {

            const hasResult = !error && response.statusCode === 200;
            resolve(hasResult ? body : '');
        });
    });
}

async function fetchXml(url) {

    return parseXml(await fetchFromUrl(url));
}

async function parseXml(xml) {

    return await new Promise(resolve => {

        parser(xml, (_, parsed) => {

            resolve(_ ? '' : parsed);
        });
    });
}
