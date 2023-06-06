/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
import dgram from 'dgram';
import assert from 'assert';
import { eventLogManagement, ciscoCheckPortUpDown } from '..';
import telegramManagement from '../database/telegramManagement';

const trapMapping = [
  'cold start',
  'warm start',
  'link down',
  'link up',
  'authentication failure',
  'egp neighbor loss',
  'enterprise specific',
];
//   0: 'cold start',
//   1: 'warm start',
//   2: 'link down',
//   3: 'link up',
//   4: 'authentication failure',
// };

const ASN1 = {
  EOC: 0,
  Boolean: 1,
  Integer: 2,
  BitString: 3,
  OctetString: 4,
  Null: 5,
  OID: 6,
  ObjectDescriptor: 7,
  External: 8,
  Real: 9, // float
  Enumeration: 10,
  PDV: 11,
  Utf8String: 12,
  RelativeOID: 13,
  Sequence: 16,
  Set: 17,
  NumericString: 18,
  PrintableString: 19,
  T61String: 20,
  VideotexString: 21,
  IA5String: 22,
  UTCTime: 23,
  GeneralizedTime: 24,
  GraphicString: 25,
  VisibleString: 26,
  GeneralString: 28,
  UniversalString: 29,
  CharacterString: 30,
  BMPString: 31,
  Constructor: 32,
  Context: 128,

  TypeError: msg => {
    const e = new Error();
    e.name = 'InvalidAsn1Error';
    e.message = msg || '';
    return e;
  },
};

function Reader(data) {
  //console.log(data);
  if (!data || !Buffer.isBuffer(data)) {
    throw new TypeError('data must be a node Buffer');
  }

  this._buf = data;
  this._size = data.length;

  // These hold the "current" state
  this._len = 0;
  this._offset = 0;

  const self = this;
  Object.defineProperty(this, 'length', {
    get: () => self._len,
  });
  Object.defineProperty(this, 'offset', {
    get: () => self._offset,
  });
  Object.defineProperty(this, 'remain', {
    get: () => self._size - self._offset,
  });
  Object.defineProperty(this, 'buffer', {
    get: () => self._buf.slice(self._offset),
  });
}

/**
 * Reads a single byte and advances offset; you can pass in `true` to make this
 * a "peek" operation (i.e., get the byte, but don't advance the offset).
 *
 * @param {Boolean} peek true means don't move offset.
 * @return {Number} the next byte, null if not enough data.
 */
Reader.prototype.readByte = function readByte(peek) {
  if (this._size - this._offset < 1) {
    return null;
  }
  const b = this._buf[this._offset] & 0xff;

  if (!peek) {
    this._offset += 1;
  }
  return b;
};

Reader.prototype.peek = function peek() {
  return this.readByte(true);
};

/**
 * Reads a (potentially) variable length off the BER buffer.  This call is
 * not really meant to be called directly, as callers have to manipulate
 * the internal buffer afterwards.
 *
 * As a result of this call, you can call `Reader.length`, until the
 * next thing called that does a readLength.
 *
 * @return {Number} the amount of offset to advance the buffer.
 * @throws {InvalidAsn1Error} on bad ASN.1
 */
Reader.prototype.readLength = function readLength(_offset) {
  let offset = _offset;
  if (offset === undefined) {
    offset = this._offset;
  }

  if (offset >= this._size) {
    return null;
  }

  let lenB = this._buf[offset++] & 0xff;
  if (lenB === null) {
    return null;
  }

  if ((lenB & 0x80) === 0x80) {
    lenB &= 0x7f;

    if (lenB === 0) {
      console.log('Indefinite length not supported');
      //throw ASN1.TypeError('Indefinite length not supported');
    }

    if (lenB > 4) {
      console.log('encoding too long');
      //throw ASN1.TypeError('encoding too long');
    }

    if (this._size - offset < lenB) {
      return null;
    }

    this._len = 0;
    for (let i = 0; i < lenB; i += 1) {
      this._len = (this._len << 8) + (this._buf[offset++] & 0xff);
    }
  } else {
    // Wasn't a variable length
    this._len = lenB;
  }

  return offset;
};

/**
 * Parses the next sequence in this BER buffer.
 *
 * To get the length of the sequence, call `Reader.length`.
 *
 * @return {Number} the sequence's tag.
 */
Reader.prototype.readSequence = function readSequence(tag) {
  const seq = this.peek();
  //console.log("tag: "${tag});
  if (seq === null) {
    return null;
  }

  if (tag !== undefined && tag !== seq) {
    console.log('read sequence');
    // console.log(
    //   `ASN1.TypeError Expected 0x${tag.toString(16)}: got 0x${seq.toString(
    //     16,
    //   )}`,
    // );
    // throw ASN1.TypeError(
    //   `Expected 0x${tag.toString(16)}: got 0x${seq.toString(16)}`,
    // );
  }

  const o = this.readLength(this._offset + 1); // stored in `length`
  if (o === null) {
    return null;
  }

  this._offset = o;
  return seq;
};

Reader.prototype.readInt = function readInt() {
  return this.readTag(ASN1.Integer);
};

Reader.prototype.readBoolean = function readBoolean() {
  return this.readTag(ASN1.Boolean) === 1;
};

Reader.prototype.readEnumeration = function readEnumeration() {
  return this.readTag(ASN1.Enumeration);
};

Reader.prototype.readString = function readString(_tag, retbuf) {
  let tag = _tag;
  if (!tag) {
    tag = ASN1.OctetString;
  }

  const b = this.peek();
  //console.log("b: "${b}", tag: "${tag});

  if (b === null) {
    return null;
  }

  if (b !== tag) {
    //console.log(b);
    // console.log(
    //   `ASN1.TypeError Expected 0x${tag.toString(16)}: got 0x${b.toString(16)}`,
    // );
    // throw ASN1.TypeError(
    //   `Expected 0x${tag.toString(16)}: got 0x${b.toString(16)}`,
    // );
  }

  const o = this.readLength(this._offset + 1); // stored in `length`

  if (o === null) {
    return null;
  }

  if (this.length > this._size - o) {
    return null;
  }

  this._offset = o;

  if (this.length === 0) {
    return retbuf ? Buffer.alloc(0) : '';
  }

  const str = this._buf.slice(this._offset, this._offset + this.length);
  this._offset += this.length;

  return retbuf ? str : str.toString('utf8');
};

Reader.prototype.readOID = function readOID(_tag) {
  let tag = _tag;
  if (!tag) {
    tag = ASN1.OID;
  }

  const b = this.readString(tag, true);
  if (b === null) {
    return null;
  }

  const values = [];
  let value = 0;

  for (let i = 0; i < b.length; i += 1) {
    const byte = b[i] & 0xff;

    value <<= 7;
    value += byte & 0x7f;
    if ((byte & 0x80) === 0) {
      values.push(value);
      value = 0;
    }
  }

  value = values.shift();
  values.unshift(value % 40);
  values.unshift((value / 40) >> 0);

  return values.join('.');
};

Reader.prototype.readTag = function readTag(tag) {
  assert.ok(tag !== undefined);

  const b = this.peek();
  //console.log("tag: "${tag}", b: "${b});

  if (b === null) {
    return null;
  }

  if (b !== tag) {
    //console.log('readTag');
    // console.log(
    //   `ASN1.TypeError Expected 0x${tag.toString(16)}: got 0x${b.toString(16)}`,
    // );
    // throw ASN1.TypeError(
    //   `Expected 0x${tag.toString(16)}: got 0x${b.toString(16)}`,
    // );
  }

  const o = this.readLength(this._offset + 1); // stored in `length`
  if (o === null) {
    return null;
  }

  if (this.length > 4) {
    //console.log(`Integer too long:${this.length}`);
    //throw ASN1.TypeError(`Integer too long:${this.length}`);
  }

  if (this.length > this._size - o) {
    return null;
  }

  this._offset = o;

  let value = 0;

  for (let i = 0; i < this.length; i += 1) {
    value <<= 8;
    value |= this._buf[this._offset++] & 0xff;
  }

  return value >> 0;
};

function parseTrapPacket(buffer) {
  const pkt = {};
  const reader = new Reader(buffer);
  reader.readSequence();
  pkt.version = reader.readInt(); // 02 01 00
  pkt.community = reader.readString(); // 04 06 70 75 62 6c 69 63
  pkt.type = reader.readSequence(); // a4
  // 0x06, 0x0c, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x81, 0x91, 0x28, 0x02, 0x02, 0x47, 0x64
  pkt.enterprise = reader.readOID();
  const bytes = reader.readString(64, true); // 0x40, 0x04, 0xc0, 0xa8, 0x17, 0x0a,
  pkt.agentAddr = `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`;
  pkt.specific = reader.readInt(); // 0x02, 0x01, 0x06,
  pkt.generic = reader.readInt(); // 0x02, 0x01, 0x0a
  pkt.upTime = reader.readTag(67); //
  pkt.varbinds = readVarbinds(reader);
  return pkt;
}

function readVarbinds(reader) {
  const vbs = [];
  reader.readSequence();
  for (;;) {
    reader.readSequence();

    const oid = reader.readOID();
    const type = reader.peek();
    let value = '';

    if (type == null) break;

    switch (type) {
      case 1:
        value = reader.readBoolean();
        break;
      case 2:
      case 65:
      case 66:
      case 67:
        value = reader.readTag(2);
        break;
      case 4:
        value = reader.readString(null);
        break;
      case 5:
      case 128:
      case 129:
      case 130:
        reader.readByte();
        reader.readByte();
        value = null;
        break;
      case 6:
        value = reader.readOID();
        break;
      case 64: {
        const bytes = reader.readString(64, true);
        value =
          bytes.length === 4
            ? `${bytes[0]}.${bytes[1]}.${bytes[2]}.${bytes[3]}`
            : '';
        break;
      }
      case 68:
      case 70:
        value = reader.readString(type, true);
        break;
      default:
        break;
    }
    vbs.push({
      oid,
      type,
      value,
    });
  }
  return vbs;
}

function Receiver(port, onTrap, onError, onStart) {
  this.port = port;
  this.socket = null;
  this.isRunning = false;
  this.onTrap = onTrap;
  this.onError = onError;
  this.onStart = onStart;
}

Receiver.prototype.start = function start() {
  try {
    const self = this;
    if (self.isRunning) return;
    const socket = (self.socket = dgram.createSocket('udp4'));
    socket.on('error', err => {
      console.error(err);
      socket.close();
      self.isRunning = false;
      if (self.onError) {
        self.onError(err);
      }
    });
    socket.on('message', (msg, remote) => {
      if (self.onTrap) {
        const pkt = parseTrapPacket(msg);
        self.onTrap(remote, pkt);
      }
    });
    socket.on('listening', () => {
      self.isRunning = true;
      if (self.onStart) {
        self.onStart(self.port);
      }
    });
    socket.bind(self.port);
  } catch (error) {
    console.error(error);
  }
};

Receiver.prototype.stop = function stop() {
  const self = this;
  if (self.isRunning) {
    if (self.socket) {
      self.socket.close();
      self.isRunning = false;
    }
  }
};
/* eslint-enable */
// { address: '192.168.5.84',
//   family: 'IPv4',
//   port: 38104,
//   size: 61,
//   version: 0,
//   community: 'test',
//   type: 164,
//   enterprise: '1.3.6.1.4.1.3755.0.0.31',
//   agentAddr: '192.168.5.84',
//   specific: 3,
//   generic: 4,
//   upTime: 7047621,
//   varbinds: [ { oid: '1.3.6.1.2.1.2.2.1.1.4', type: 2, value: 4 } ],
//   msg: 'link up' }

const trap = new Receiver(
  162,
  (remote, pkt) => {
    const sourceIP = remote.address;
    const {
      version,
      community,
      enterprise,
      specific,
      generic,
      upTime,
      varbinds,
    } = pkt;

    try {
      const trapMsg = {
        sourceIP,
        version,
        community,
        enterprise,
        specific,
        generic,
        upTime,
        varbinds: JSON.stringify(varbinds),
        msg: `Port ${generic} - ${trapMapping[specific]}`,
      };
      eventLogManagement.default.updateEventLog(trapMsg, 'trap');
      //console.log('Trap received');
      //console.log(trapMsg);
      // console.log('--------------------------------------');
      // console.log(pkt);
      // console.log('--------------------------------------');
      const isCiscoDevice = getCiscoDeviceIpArray(trapMsg.sourceIP);
      if (!isCiscoDevice) {
        eventLogManagement.default.updateEventLog(trapMsg, 'custom');
      }

      //telegramManagement.sendMessageTelegram(trapMsg);
    } catch (error) {
      //console.log(error);
    }
  },
  error => {
    console.log(error);
  },
  port => {
    console.log(`Trap server start listen on : ${port}`);
  },
);

trap.start();

function getCiscoDeviceIpArray(ipAddress) {
  const {
    deviceListArray,
    onlineArrayDeviceList,
  } = ciscoCheckPortUpDown.default.getCiscoDeviceDetails();
  const ciscoDeviceIpList = deviceListArray.map(cd => cd.IPAddress);

  if (onlineArrayDeviceList.length <= 0) {
    return true;
  } else {
    return ciscoDeviceIpList.includes(ipAddress);
  }
}
