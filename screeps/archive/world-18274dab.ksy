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
      - '0x18'
      - '0x27'
      - '0x4d'
      - '0xab'
  - id: size
    type: u4
  - id: zero
    contents:
      - 0
      - 0
      - 0
      - 0
  - id: value
    type: world
types:
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
  world:
    seq:
      - id: world_ofs
        type: u4
    instances:
      world:
        type: world
        io: _root._io
        pos: world_ofs - 4
        if: world_ofs > 0
        repeat: until
        repeat-until: _.next_ofs == 0
        '-webide-parse-mode': eager
    types:
      world:
        seq:
          - id: next_ofs
            type: u4
          - id: value
            type: value
          - size: 'next_ofs == 0 ? 0 : next_ofs - _io.pos - 4'
        types:
          value:
            seq:
              - id: info
                type: info
              - size: 2
              - id: name
                type: js_str
            types:
              info:
                seq:
                  - id: terrain
                    type: u1
                    repeat: expr
                    repeat-expr: 625
                  - id: exits
                    type: u1
