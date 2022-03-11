import requestsFunction from './requests.js'
import fs from 'fs'
const requests = requestsFunction()

import Discord from 'discord.js';
const client = new Discord.Client({ intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_VOICE_STATES, Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS] });

const sessions = {}
const users_tokens = {}
const matches = {}
const messages = {}

fs.readFile('./config.json', 'utf8', (err, data)=>{
    if (err) {
        console.log(`Error reading file from disk: ${err}`);
    } else {
        client.login(JSON.parse(data).token)
    }
})

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.content.startsWith("t! ")) {
        processCommand(message, message.channel, message.member)
    }
});

function processCommand(message, channel, user) {
    const command = message.content.substring(3)
    switch (command) {
        case "ping":
            channel.send("pong")
            break;
        case "help":
            help(channel)
            break;
        case "start":
            start(channel, user)
            break;
        case "stop":
            stop(channel, user)
            break;
        case "yes":
            vote(channel, user, true)
            break;
        case "no":
            vote(channel, user, false)
            break;
        case "skip":
            skip(channel, user)
            break;
        default:
            if(command.startsWith("token") && command.split(" ").length === 2) {
                tinder_token(message, channel, user)
            } else {
                channel.send(`commande inconnu ${user}`)
            }
    }
}

function help(channel) {
    channel.send(
        "Liste des commandes: \n"+
        " - t! start: commence une session de vote, necessite d'être dans un channel vocal \n" +
        " - t! token <token>: necessaire pour commencer la session de vote si je te le reclame. Pour obtenir ton token, connecte toi à ton navigateur, ouvre la console avec F12 et entre la commande 'localStorage.getItem('TinderWeb/APIToken')' \n" +
        " - t! stop: arrête la session de vote"
    )
}

function start(channel, user) {
    if(sessions[channel]) {
        if(sessions[channel].user === user) {
            channel.send(`${user} Vous avez déjà demarré une session de vote dans ce channel.`)
        } else {
            channel.send(`Une session créée par ${sessions[channel].user} est déjà en cours dans ce channel.`)
        }
    } else {
        if(user.voice.channel) {
            check_token(user).then((result) => {
                if(result) {
                    start_session(user, channel).then(()=>{sessions[channel]["last_message"] = "first"})
                }
                else {
                    channel.send(`Aucun token n'a été trouvé pour ${user}, renseignez le avec la commande t! token <token>`)
                }
            })
        } else {
            channel.send(`Vous devez être dans un salon vocal pour lancer une session.`)
        }
    }
}

async function check_token(user) {
    if (users_tokens[user]) {
        const result = await requests.getUserData(users_tokens[user])
        return result.meta.status !== 401
    }
    // no token found for given user
    return false
}

function tinder_token(message, channel, user) {
    const t = message.content.substring(3).split(" ")[1]

    requests.getUserData(t).then((result) => {
        if(result.meta.status !== 401) {
            message.delete()
            users_tokens[user] = t
            channel.send(`${user}, votre token est correcte et a bien été enregistré.`)
        } else {
            channel.send(`${user}, votre token est invalide.`)
        }
    })
}

function stop(channel, user) {
    if(!sessions[channel]) {
        channel.send(`${user}, aucune session n'est en cours dans ce channel.`)
    } else if(user === sessions[channel].user || user.permissions.has('ADMINISTRATOR')) {
        channel.send(`${user}, vous avez arrété la session en cours.`)
        remove_session(channel)
    } else {
        channel.send(`${user}, vous n'êtes ni l'host de la session ni administrateur du serveur.`)
    }
}

function remove_session(channel) {
    sessions[channel] = undefined
}

function start_session(user, channel) {
    return requests.getUserData(users_tokens[user]).then(
        (result) => {
            if(result.data.likes.likes_remaining === 0) {
                channel.send(`${user} n'a pas de likes disponible, la session ne peut pas se lancer.`)
            } else {
                channel.send(`Une nouvelle session a été lancée par ${user}, rejoignez le salon vocal ${user.voice.channel.name} pour participer.`)
                new_match(user, channel)
                compute_and_send_next_match(user, channel).then((result)=>{})
            }
        }
    )
}

function next_match(user, channel) {
    new_match(user, channel)
    compute_and_send_next_match(user, channel).then((result)=>{})
}

function new_match(user, channel) {
    if(!user.voice.channel) {
        channel.send(`${user}, l'host de la session, n'est plus dans un channel vocal.`)
        remove_session(channel)
    }
    let u = user
    if(sessions[channel]) {
        u = sessions[channel].user
    }
    if(sessions[channel]) {
        sessions[channel]["last_message"].reactions.removeAll()
        delete messages[sessions[channel]["last_message"]]
    }
    sessions[channel] = {
        "user": u,
        "voice_channel": user.voice.channel,
        "last_match": undefined,
        "has_voted": [],
        "votes_yes": 0,
        "votes_no": 0,
        "lock": true
    }
    const userMap = user.voice.channel.members.filter((user)=>!user.user.bot)
    sessions[channel].to_vote = Array.from(userMap).map((a) => a[1])
    channel.send(`Les votant pour ce match sont: ${sessions[channel].to_vote}`)
}

async function compute_and_send_next_match(user, channel) {
    if(!matches[sessions[channel].user]) {
        matches[sessions[channel].user] = []
    }
    if(matches[sessions[channel].user].length === 0) {
        matches[sessions[channel].user] = (await requests.getMatches(users_tokens[sessions[channel].user])).data.results
    }
    let m = matches[sessions[channel].user].shift()
    sessions[channel].last_match = m.user
    display_match(m, channel)
    sessions[channel].lock = false
    return m
}

function vote(channel ,user, yes) {
    if(sessions[channel].lock){
        setTimeout(() => vote(channel ,user, yes),1);
        return
    }
    if(sessions[channel].has_voted.includes(user)) {
        channel.send(`${user}, tu a déjà voté !`)
        return
    }
    if(!sessions[channel].to_vote.includes(user)) {
        channel.send(`${user}, tu ne fais pas parti ce cette session de vote`)
        return
    }
    if(yes) {
        sessions[channel].votes_yes++
    } else {
        sessions[channel].votes_no++
    }

    sessions[channel].to_vote = sessions[channel].to_vote.filter((u)=>u !== user)
    sessions[channel].has_voted.push(user)

    if(sessions[channel].to_vote.length === 0) {
        // Resolve
        sessions[channel].lock = true
        resolveMatch(channel).then(() => next_match(user, channel))
    } else {
        channel.send(`${sessions[channel].to_vote.length} votes restant`)
    }
}

async function resolveMatch(channel) {
    let res = true
    let name = sessions[channel].last_match.name
    if(sessions[channel].votes_no >= sessions[channel].votes_yes) {
        channel.send(`Le vote à décider de skip ${name}.`)
        res = false
    } else {
        channel.send(`Le vote à décider de like ${name}.`)
    }
    let result = await requests.sendResultMatch(users_tokens[sessions[channel].user], res, sessions[channel].last_match._id)
    if(result["likes_remaining"] && result["likes_remaining"] === 0) {
        channel.send(`${sessions[channel].user} n'a plus de likes, fin de la session...` )
    }
}

function skip(channel, user) {
    if(!sessions[channel]) {
        channel.send(`${user}, aucune session n'est en cours dans ce channel.`)
    } else if((user === sessions[channel].user || user.permissions.has('ADMINISTRATOR')) && sessions[channel]["last_message"] && (sessions[channel]["last_message"].reactions || sessions[channel]["last_message"] === "first")) {
        channel.send(`${user} passe au match suivant.`)
        resolveMatch(channel).then(()=>next_match(user, channel))
    } else {
        channel.send(`${user}, vous n'êtes ni l'host de la session ni administrateur du serveur.`)
    }
}

function display_match(match, channel) {
    let user = match.user
    let birth = user.birth_date.substring(0,10).split("-")
    let birthDate = new Date(birth[0],birth[1]-1,birth[2])
    let today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    let m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate()))
    {
        age--;
    }

    // Obtenir le travail
    let jobs = ""
    user.jobs.forEach((j)=>{
        if(j.title && j.title.name) {
            jobs += `${j.title.name}`
        }
    })
    if(jobs === "") {
        jobs = "Non renseigné"
    }

    // Obtenir l'école
    let schools = ""
    user.schools.forEach((j)=>{
        schools += `${j.name}`
    })
    if(schools === "") {
        schools = "Non renseigné"
    }

    // Les centres d'interet
    let interest = "-"
    if(match.experiment_info && match.experiment_info.user_interests) {
        let interests_array = match.experiment_info.user_interests.selected_interests
        interests_array.forEach((i)=>{
            interest += `${i.name}\n`
        })
    }

    let bio = user.bio
    if(!bio) {
        bio = "-"
    }
    const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(user.name)
        .setDescription(`${age} ans`)
        //.setThumbnail('https://i.imgur.com/AfFp7pu.png')
        .addFields({ name: 'Description', value: bio })
        .addFields(
            { name: '\u200B', value: '\u200B' },
            { name: 'Interêts', value: interest, inline: true },
            { name: 'Travail', value: jobs, inline: true },
            { name: 'Ecole', value: schools, inline: true },
        )

        //.setFooter({ text: 'Some footer text here', iconURL: 'https://i.imgur.com/AfFp7pu.png' });

    let numPhotos = user.photos.length
    channel.send({ embeds: [exampleEmbed.setImage(user.photos[0].processedFiles[0].url)] }).then((m)=>{
        if(numPhotos > 1) {
            m.react('⬅️').then(() => {
                m.react('➡️').then(
                 () => {
                     sessions[channel]["last_message"] = m
                     sessions[channel]["pos_photo"] = 0
                     sessions[channel]["numPhotos"] = numPhotos
                     sessions[channel]["embed"] = exampleEmbed
                     sessions[channel]["photos"] = user.photos
                     messages[m] = channel
                }
            )})
        }
    });
}

const filter = (reaction, user) => {
    return ['⬅️', '➡️'].includes(reaction.emoji.name) && user.id !== client.user.id;
};

client.on('messageReactionAdd', (reaction, user) => {
    if(filter(reaction, user)) {
        console.log("OK")
        let channel = reaction.message.channel
        if (reaction.emoji.name === '⬅️') {
            sessions[channel]["pos_photo"]--
        } else {
            sessions[channel]["pos_photo"]++
        }
        if (sessions[channel]["pos_photo"] === -1) {
            sessions[channel]["pos_photo"] = sessions[channel]["numPhotos"] - 1
        }
        if (sessions[channel]["pos_photo"] === sessions[channel]["numPhotos"]) {
            sessions[channel]["pos_photo"] = 0
        }
        sessions[channel]['last_message'].edit({embeds: [sessions[channel]["embed"].setImage(sessions[channel]["photos"][sessions[channel]["pos_photo"]].processedFiles[0].url)]});
    }
})
