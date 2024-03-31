import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch';

const dataDir = './data';

// let input = '值日生又沒擦黑板'
let input = '大家好我是貓虎皮'

var url = `https://api.zhconvert.org/convert?text=${input}&converter=Bopomofo`;
fetch(url)
    .then(res => res.json())
    .then(json => json['data']['text'].split(' '))
    .then(data => data.map(key => {
        let keyFile = path.join(dataDir, 'key2word', `${key}.txt`);
        if(fs.existsSync(keyFile)){
            var  content = fs.readFileSync(keyFile, 'utf8');
            var words = content.split('\n');
            return words[Math.floor(Math.random() * words.length)];
        }
        else{
            return 'xx';
        }
    }))
    .then(t => console.log(t.join('')));