import requestsFunction from './requests.js'
const requests = requestsFunction()

const token = "7e9b6491-a989-455c-a917-a0a9b2c7c95f"

let matches = await requests.getMatches(token)

// Calcul de l'âge
let user = matches.data.results[0].user
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
    jobs += `${j.title.name}`
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
let interest = ""
if(matches.data.results[0].experiment_info && matches.data.results[0].experiment_info.user_interests) {
    let interests_array = matches.data.results[0].experiment_info.user_interests.selected_interests
    interests_array.forEach((i)=>{
        interest += `${i.name},`
    })
    if(interest !== "") {
        interest = interest.substring(0,interest.length - 1)
    }
}

/*
console.log(`Title: ${user.name} - ${age} ans`)
console.log(`Description: ${user.bio}`)
console.log(`Travail: ${jobs}`)
console.log(`Ecole: ${schools}`)
console.log(`Interêts: ${interest}`)
*/

console.log(matches.data.results[0].user.photos[0].processedFiles[0].url)
console.log(matches.data.results[0].user.photos[0].length)

