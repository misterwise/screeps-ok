meta:
  id: screeps
  endian: le
seq:
  - id: magic
    contents:
      - '0x00'
      - '0x5a'
      - '0xf3'
      - '0xff'
  - id: version
    contents:
      - '0x28'
      - '0x23'
      - '0x65'
      - '0x3e'
  - id: size
    type: u4
  - id: zero
    contents:
      - 0
      - 0
      - 0
      - 0
  - id: value
    type: flags
types:
  flag:
    seq:
      - id: super
        type: room_object
      - id: name
        type: js_str
      - id: color
        type: s1
      - id: secondary_color
        type: s1
  flags:
    seq:
      - id: flags_ofs
        type: u4
    instances:
      flags:
        type: flags
        io: _root._io
        pos: flags_ofs - 4
        if: flags_ofs > 0
        repeat: until
        repeat-until: _.next_ofs == 0
        '-webide-parse-mode': eager
    types:
      flags:
        seq:
          - id: next_ofs
            type: u4
          - id: value
            type: flag
          - size: 'next_ofs == 0 ? 0 : next_ofs - _io.pos - 4'
  id:
    seq:
      - id: id_len
        type: u1
      - size: 3
      - id: id
        type: u4
        repeat: expr
        repeat-expr: 3
  js_str:
    seq:
      - id: str_ofs
        type: u4
      - id: str_len
        type: s4
    instances:
      latin1:
        type: str
        io: _root._io
        pos: str_ofs
        size: str_len
        encoding: Latin1
        if: str_len >= 0
        '-webide-parse-mode': eager
      utf8:
        type: str
        io: _root._io
        pos: str_ofs
        size: str_len * -2
        encoding: UTF-16LE
        if: str_len < 0
        '-webide-parse-mode': eager
  room_object:
    seq:
      - id: id
        type: id
      - id: pos
        type: room_position
  room_position:
    seq:
      - id: rx
        type: s1
      - id: ry
        type: s1
      - id: x
        type: s1
      - id: 'y'
        type: s1
