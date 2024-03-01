import { DataBase, setDatabase } from 'src/ts/storage/database';
import { selectedCharID } from 'src/ts/stores';
import { get } from 'svelte/store';
import { doingChat, sendChat } from '..';
import { downloadFile, isTauri } from 'src/ts/storage/globalApi';
import { HypaProcesser } from '../memory/hypamemory';
import { BufferToText as BufferToText, selectSingleFile, sleep } from 'src/ts/util';
import { postInlayImage } from './image';

type sendFileArg = {
    file:string
    query:string
}

async function sendPofile(arg:sendFileArg){

    let result = ''
    let msgId = ''
    let parseMode = 0
    const db = get(DataBase)
    let currentChar = db.characters[get(selectedCharID)]
    let currentChat = currentChar.chats[currentChar.chatPage]
    const lines = arg.file.split('\n')
    for(let i=0;i<lines.length;i++){
        console.log(i)
        const line = lines[i]
        if(line === ''){
            if(msgId === ''){
                result += '\n'
                continue
            }
            const id = msgId
            currentChat.message.push({
                role: 'user',
                data: id
            })
            currentChar.chats[currentChar.chatPage] = currentChat
            db.characters[get(selectedCharID)] = currentChar
            setDatabase(db)
            doingChat.set(false)
            await sendChat(-1);
            currentChar = db.characters[get(selectedCharID)]
            currentChat = currentChar.chats[currentChar.chatPage]
            const res = currentChat.message[currentChat.message.length-1]
            const msgStr = res.data.split('\n').filter((a) => {
                return a !== ''
            }).map((str) => {
                return `"${str.replaceAll('"', '\\"')}"`
            }).join('\n')
            result += `msgstr ""\n${msgStr}\n\n`

            msgId = ''
            if(isTauri){
                await downloadFile('translated.po', result)
            }
            continue
        }
        if(line.startsWith('msgid')){
            parseMode = 0
            msgId = line.replace('msgid ', '').trim().replaceAll('\\"', '♠#').replaceAll('"', '').replaceAll('♠#', '\\"')
            if(msgId === ''){
                parseMode = 1
            }
            result += line + '\n'
            continue
        }
        if(parseMode === 1 && line.startsWith('"') && line.endsWith('"')){
            msgId += line.substring(1, line.length-1).replaceAll('\\"', '"')
            result += line + '\n'
            continue
        }
        if(line.startsWith('msgstr')){
            if(msgId === ''){
                result += line + '\n'
                parseMode = 0
            }
            else{
                parseMode = 2
            }
            continue
        }
        if(parseMode === 2 && line.startsWith('"') && line.endsWith('"')){
            continue
        }
        result += line + '\n'

        if(i > 100){
            break //prevent too long message in testing
        }

    }
    await downloadFile('translated.po', result)
}

async function sendPDFFile(arg:sendFileArg) {
    const pdfjsLib = (await import('pdfjs-dist')).default;
    const pdf = await pdfjsLib.getDocument({data: arg.file}).promise;
    const db = get(DataBase)
    const texts:string[] = []
    for(let i = 1; i<=pdf.numPages; i++){
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const items = content.items as {str:string}[];
        for(const item of items){
            texts.push(item.str)
        }
    }
    const hypa = new HypaProcesser('MiniLM')
    hypa.addText(texts)
    let currentChar = db.characters[get(selectedCharID)]
    let currentChat = currentChar.chats[currentChar.chatPage]
    const result = await hypa.similaritySearch(arg.query)
    let message = arg.query
    for(let i = 0; i<result.length; i++){
        message += "\n" + texts[result[i]]
        if(i>5){
            break
        }
    }
    currentChat.message.push({
        role: 'user',
        data: message
    })

    currentChar.chats[currentChar.chatPage] = currentChat
    db.characters[get(selectedCharID)] = currentChar
    setDatabase(db)
    await sendChat(-1)
}

type postFileResult = postFileResultImage | postFileResultVoid

type postFileResultImage = {
    data: string,
    type: 'image',
}

type postFileResultVoid = {
    type: 'void',
}

export async function postChatFile(query:string):Promise<postFileResult>{
    const file = await selectSingleFile([
        //image format
        'jpg',
        'jpeg',
        'png',
        'webp',
        'po',
        'pdf'
    ])

    if(!file){
        return null
    }

    const extention = file.name.split('.').at(-1)
    console.log(extention)

    switch(extention){
        case 'po':{
            await sendPofile({
                file: BufferToText(file.data),
                query: query
            })
            return {
                type: 'void'
            }
        }
        case 'pdf':{
            await sendPDFFile({
                file: BufferToText(file.data),
                query: query
            })
            return {
                type: 'void'
            }
        }
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp':{
            const postData = await postInlayImage(file)
            return {
                data: postData,
                type: 'image'
            }
        }
    }

    return 
}