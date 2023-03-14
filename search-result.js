import { searchString } from "./app.js";

class ResultString {
  constructor(message) {
    this.content = message.content;
    this.embeds = [];
    this.attachments = [];
    this.contentLength = 0;
  }

  toHtml() {
    this.content.replace(/<|>/, '_');
    let htmlString = `<tr> <td rowspan="${this.contentLength}">${this.content}</td>`;
    for (const embed of this.embeds) {
      if (embed) {
        htmlString += `<td>${embed.title}</td> <td><a href="${embed.url}">Embed page URL</a></td> <td></td> <td></td> </tr> <tr>`;
      }
    }
    for (const attach of this.attachments) {
      if (attach) {
      htmlString += `<td></td> <td></td> <td>${attach.filename}</td> <td><a href="${attach.url}">Attachment URL</a></td> </tr> <tr>`;
    }
    }
    //Removing last <tr> tag
    htmlString = htmlString.slice(0, -5);
    return htmlString;
  }
}

export let resultStringArray = [];

export function searchResult(message) {
  let newString;
  //If we get coincidence in message content - add all attachments and embeds
  if (message.content.includes(searchString) && (message.embeds.lenght !== 0 || message.attachments.length !== 0)) {
    newString = new ResultString(message);
    newString.embeds = message.embeds;
    newString.attachments = message.attachments;
    newString.contentLength = newString.embeds.length + newString.attachments.length;
  //Else we check each embed and attach for coincidence in title or name
  } else if (message.embeds.lenght !== 0 || message.attachments.length !== 0) {    
    for (const embed of message.embeds) {
      if (embed.title.includes(searchString)) {
        if (!newString) {
          newString = new ResultString(message);
        }
        newString.embeds.push(embed);
      }
    }
    for (const attach of message.attachments) {
      if (attach.filename.includes(searchString)) {
        if (!newString) {
          newString = new ResultString(message);
        }
        newString.attachments.push(attach);
      }
    }
    if (newString?.embeds) {
      newString.contentLength += newString.embeds.length;
    }
    if (newString?.attachments) {
      newString.contentLength += newString.attachments.length;
    }
  }
  if (newString) {
    resultStringArray.push(newString);
    newString = undefined;
  }
}

export function makeResult(resultStringArray) {
  let result =
    `<!DOCTYPE html> <html> <head> <meta charset="UTF-8"> <title>Links table</title> </head> <body> <table style="border:2px solid black; margin: auto; margin-top: 100px"> <tr> <th>Message content</th> <th>Embed title</th> <th>Embed page url</th> <th>Attachment Name</th> <th>Attachment URL</th> </tr>`;
  for (const resultString of resultStringArray) {
    result += resultString.toHtml();
  }
  result += `</table> </body> </html>`;
  return result;
}
