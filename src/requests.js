import fetch from 'node-fetch';

function getHeader(token) {
    return {
        "X-Auth-Token": token,
        "origin": "https://tinder.com" ,
        "authority": "api.gotinder.com",
        "path": "/v2/fast-match/teasers",
        "scheme": "https",
        "accept": "*/*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "referer": "https://tinder.com/",
        "sec-ch-ua": "' Not A;Brand';v='99', 'Chromium';v='98', 'Google Chrome';v='98'",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "Windows",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site"
    }
}

async function getUserData(token) {
    return await fetch("https://api.gotinder.com/v2/profile?locale=fr&include=likes%2Cofferings%2Cplus_control%2Cpurchase%2Cuser", {
        method: "GET",
        headers: getHeader(token)
    }).then(res => res.json())
}

async function getMatches(token) {
    return await fetch(" https://api.gotinder.com/v2/recs/core?locale=fr", {
        method: "GET",
        headers: getHeader(token)
    }).then(res => res.json())
}

async function getMatched(token) {
    return await fetch(" https://api.gotinder.com/v2/matches?locale=fr&count=60&message=0&is_tinder_u=false", {
        method: "GET",
        headers: getHeader(token)
    }).then(res => res.json())
}

async function sendResultMatch(token, like, id) {
    let v = like ? "like" : "pass"
    return await fetch(`https://api.gotinder.com/${v}/${id}?locale=fr`, {
        method: "POST",
        headers: getHeader(token)
    }).then(res => {
        return res.json()
    })
}

export default function requestsFunction() {
    return {
        'getUserData': getUserData,
        'getMatches': getMatches,
        'getMatched': getMatched,
        'sendResultMatch': sendResultMatch
    }
}
