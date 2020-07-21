const fetch = require("node-fetch")
const dateFormat = require('date-fns/format')

this.camerasList = function (credentials) {
  return new Promise((resolve, reject) => {
    fetch(
      process.env.EVERCAM_URL +
        "/cameras?api_id=" +
        credentials.api_id +
        "&api_key=" +
        credentials.api_key,
      {
        method: "GET",
      }
    )
      .then((resp) => resolve(resp.json()))
      .catch((error) => reject(error))
  })
}

this.getCredentials = function (telephone) {
  return new Promise((resolve) => {
    fetch(
      process.env.EVERCAM_URL +
        "/users/whatsapp/%2B" +
        telephone +
        "/credentials?token=" +
        process.env.WHATSAPP_TOKEN,
      { method: "get" }
    )
      .then((resp) => resp.json())
      .then(function (response) {
        if (response.api_id && response.api_key) {
          resolve(response)
        } else {
          resolve(false)
        }
      })
      .catch(() => {
        resolve(false)
      })
  })
}


// Return all gate repots events by day
this.getAllGateReportsByDay = async function(credentials, cameraId) {
    let url = new URL(process.env.EVERCAM_URL + "/cameras/" + cameraId + "/in-out/auto/results/days")
    let truckTypes = [
        "tipping-truck",
        "truck-mixer",
        "semi-trailer",
        "flatbed-semi-trailer",
        "small-truck",
        "concrete-pump",
        "other-truck",
    ]

    truckTypes.forEach(truckType => {
        url.searchParams.append("truck_type[]", truckType);
    })
    url.searchParams.append("api_id", credentials.api_id);
    url.searchParams.append("api_key", credentials.api_key);

    let response =  await fetch(url, { method: "GET"})
    let payload = await response.json()
    return await payload.days
}

this.getLastGateReportDate = async function(credentials,  camera) {
    let days = await this.getAllGateReportsByDay(credentials, camera)
    let daysWithEvents = days.filter(day => day.avg)

    if (Array.isArray(daysWithEvents) && daysWithEvents.length > 0) {
        let lastEvent = daysWithEvents.pop()
        return  new Date(lastEvent.date)
    }

    throw new Error("No available gate report")
}

this.getGateReportDetection = async function(credentials, cameraId, date) {
    let formatedDate = dateFormat(date, "yyyy/MM/dd")
    let url = new URL(process.env.EVERCAM_URL + "/cameras/" + cameraId + "/in-out/auto/" + formatedDate + "/detections")

    let truckTypes = [
        "tipping-truck",
        "truck-mixer",
        "semi-trailer",
        "flatbed-semi-trailer",
        "small-truck",
        "concrete-pump",
        "other-truck",
    ]

    truckTypes.forEach(truckType => {
        url.searchParams.append("truck_type[]", truckType);
    })
    url.searchParams.append("api_id", credentials.api_id);
    url.searchParams.append("api_key", credentials.api_key);

    let response =  await fetch(url, { method: "GET"})
    let payload = await response.json()
    let events = payload.outputs

    if (Array.isArray(events) && events.length > 0) {
        return events.pop()
    }

    throw new Error("No available gate report")
}

this.getArrivedThumbnail = async function(credentials, event) {
    let url = new URL(`${process.env.EVERCAM_URL}/cameras/${event.exid}/in-out/thumbnail/auto/arrived/${event.arrived_time}`)

    url.searchParams.append("api_id", credentials.api_id);
    url.searchParams.append("api_key", credentials.api_key);

    let response = await fetch(url)
    let buf = await response.buffer()
    let encodedBuf = await buf.toString("base64")
    return  "data:image/png;base64," + encodedBuf
}


this.getLeftThumbnail = async function(credentials, event) {
    let url = new URL(`${process.env.EVERCAM_URL}/cameras/${event.exid}/in-out/thumbnail/auto/left/${event.left_time}`)

    url.searchParams.append("api_id", credentials.api_id);
    url.searchParams.append("api_key", credentials.api_key);


    let response = await fetch(url)
    let buf = await response.buffer()
    let encodedBuf = await buf.toString("base64")
    return  "data:image/png;base64," + encodedBuf
}

this.getImage = async function(url) {
    let response = await fetch(url)
    let buf = await response.buffer()
    let encodedBuf = await buf.toString("base64")
    return  "data:image/png;base64," + encodedBuf
}
