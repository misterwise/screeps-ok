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
      - '0x87'
      - '0x69'
      - '0x57'
      - '0xbd'
  - id: size
    type: u4
  - id: zero
    contents:
      - 0
      - 0
      - 0
      - 0
  - id: value
    type: visual
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
  visual:
    seq:
      - id: visual_ofs
        type: u4
    instances:
      visual:
        type: visual
        io: _root._io
        pos: visual_ofs - 4
        if: visual_ofs > 0
        repeat: until
        repeat-until: _.next_ofs == 0
        '-webide-parse-mode': eager
    types:
      visual:
        seq:
          - id: next_ofs
            type: u4
          - id: value_ofs
            type: u4
          - id: value_type
            type: u1
          - size: value_ofs - _io.pos
          - id: value
            type:
              switch-on: value_type
              cases:
                '0': variant0
                '1': variant1
                '2': variant2
                '3': variant3
                '4': variant4
          - size: 'next_ofs == 0 ? 0 : next_ofs - _io.pos - 4'
        types:
          variant0:
            seq:
              - id: s
                type: s
              - size: 7
              - id: x1
                type: f8
              - id: x2
                type: f8
              - id: y1
                type: f8
              - id: y2
                type: f8
            types:
              s:
                seq:
                  - id: opacity_stream
                    type: opacity_stream
                    size: 8
                  - id: has_opacity
                    type: u1
                  - id: line_style_stream
                    type: line_style_stream
                    size: 1
                  - id: has_line_style
                    type: u1
                  - size: 1
                  - id: color_stream
                    type: color_stream
                    size: 8
                  - id: has_color
                    type: u1
                  - size: 3
                  - id: width_stream
                    type: width_stream
                    size: 8
                  - id: has_width
                    type: u1
                instances:
                  color:
                    type: js_str
                    io: color_stream._io
                    pos: 0
                    if: has_color != 0
                    '-webide-parse-mode': eager
                  line_style:
                    type: line_style
                    io: line_style_stream._io
                    pos: 0
                    if: has_line_style != 0
                    '-webide-parse-mode': eager
                  opacity:
                    type: f8
                    io: opacity_stream._io
                    pos: 0
                    if: has_opacity != 0
                    '-webide-parse-mode': eager
                  width:
                    type: f8
                    io: width_stream._io
                    pos: 0
                    if: has_width != 0
                    '-webide-parse-mode': eager
                types:
                  color_stream:
                    seq:
                      - size: 8
                  line_style:
                    seq:
                      - id: line_style
                        type: u1
                        enum: line_style
                    enums:
                      line_style:
                        '0': empty
                        '1': dashed
                        '2': dotted
                  line_style_stream:
                    seq:
                      - size: 1
                  opacity_stream:
                    seq:
                      - size: 8
                  width_stream:
                    seq:
                      - size: 8
          variant1:
            seq:
              - id: s
                type: s
              - size: 7
              - id: x
                type: f8
              - id: 'y'
                type: f8
            types:
              s:
                seq:
                  - id: opacity_stream
                    type: opacity_stream
                    size: 8
                  - id: has_opacity
                    type: u1
                  - id: line_style_stream
                    type: line_style_stream
                    size: 1
                  - id: has_line_style
                    type: u1
                  - size: 1
                  - id: fill_stream
                    type: fill_stream
                    size: 8
                  - id: has_fill
                    type: u1
                  - size: 3
                  - id: radius_stream
                    type: radius_stream
                    size: 8
                  - id: has_radius
                    type: u1
                  - size: 3
                  - id: stroke_stream
                    type: stroke_stream
                    size: 8
                  - id: has_stroke
                    type: u1
                  - size: 3
                  - id: stroke_width_stream
                    type: stroke_width_stream
                    size: 8
                  - id: has_stroke_width
                    type: u1
                instances:
                  fill:
                    type: js_str
                    io: fill_stream._io
                    pos: 0
                    if: has_fill != 0
                    '-webide-parse-mode': eager
                  line_style:
                    type: line_style
                    io: line_style_stream._io
                    pos: 0
                    if: has_line_style != 0
                    '-webide-parse-mode': eager
                  opacity:
                    type: f8
                    io: opacity_stream._io
                    pos: 0
                    if: has_opacity != 0
                    '-webide-parse-mode': eager
                  radius:
                    type: f8
                    io: radius_stream._io
                    pos: 0
                    if: has_radius != 0
                    '-webide-parse-mode': eager
                  stroke:
                    type: js_str
                    io: stroke_stream._io
                    pos: 0
                    if: has_stroke != 0
                    '-webide-parse-mode': eager
                  stroke_width:
                    type: f8
                    io: stroke_width_stream._io
                    pos: 0
                    if: has_stroke_width != 0
                    '-webide-parse-mode': eager
                types:
                  fill_stream:
                    seq:
                      - size: 8
                  line_style:
                    seq:
                      - id: line_style
                        type: u1
                        enum: line_style
                    enums:
                      line_style:
                        '0': empty
                        '1': dashed
                        '2': dotted
                  line_style_stream:
                    seq:
                      - size: 1
                  opacity_stream:
                    seq:
                      - size: 8
                  radius_stream:
                    seq:
                      - size: 8
                  stroke_stream:
                    seq:
                      - size: 8
                  stroke_width_stream:
                    seq:
                      - size: 8
          variant2:
            seq:
              - id: s
                type: s
              - size: 3
              - id: h
                type: f8
              - id: w
                type: f8
              - id: x
                type: f8
              - id: 'y'
                type: f8
            types:
              s:
                seq:
                  - id: opacity_stream
                    type: opacity_stream
                    size: 8
                  - id: has_opacity
                    type: u1
                  - id: line_style_stream
                    type: line_style_stream
                    size: 1
                  - id: has_line_style
                    type: u1
                  - size: 1
                  - id: fill_stream
                    type: fill_stream
                    size: 8
                  - id: has_fill
                    type: u1
                  - size: 3
                  - id: stroke_width_stream
                    type: stroke_width_stream
                    size: 8
                  - id: has_stroke_width
                    type: u1
                  - size: 3
                  - id: stroke_stream
                    type: stroke_stream
                    size: 8
                  - id: has_stroke
                    type: u1
                instances:
                  fill:
                    type: js_str
                    io: fill_stream._io
                    pos: 0
                    if: has_fill != 0
                    '-webide-parse-mode': eager
                  line_style:
                    type: line_style
                    io: line_style_stream._io
                    pos: 0
                    if: has_line_style != 0
                    '-webide-parse-mode': eager
                  opacity:
                    type: f8
                    io: opacity_stream._io
                    pos: 0
                    if: has_opacity != 0
                    '-webide-parse-mode': eager
                  stroke:
                    type: js_str
                    io: stroke_stream._io
                    pos: 0
                    if: has_stroke != 0
                    '-webide-parse-mode': eager
                  stroke_width:
                    type: f8
                    io: stroke_width_stream._io
                    pos: 0
                    if: has_stroke_width != 0
                    '-webide-parse-mode': eager
                types:
                  fill_stream:
                    seq:
                      - size: 8
                  line_style:
                    seq:
                      - id: line_style
                        type: u1
                        enum: line_style
                    enums:
                      line_style:
                        '0': empty
                        '1': dashed
                        '2': dotted
                  line_style_stream:
                    seq:
                      - size: 1
                  opacity_stream:
                    seq:
                      - size: 8
                  stroke_stream:
                    seq:
                      - size: 8
                  stroke_width_stream:
                    seq:
                      - size: 8
          variant3:
            seq:
              - id: s
                type: s
              - size: 3
              - id: points_ofs
                type: u4
              - id: points_len
                type: s4
            instances:
              points:
                type: f8
                io: _root._io
                pos: points_ofs
                repeat: expr
                repeat-expr: points_len
                '-webide-parse-mode': eager
            types:
              s:
                seq:
                  - id: opacity_stream
                    type: opacity_stream
                    size: 8
                  - id: has_opacity
                    type: u1
                  - id: line_style_stream
                    type: line_style_stream
                    size: 1
                  - id: has_line_style
                    type: u1
                  - size: 1
                  - id: fill_stream
                    type: fill_stream
                    size: 8
                  - id: has_fill
                    type: u1
                  - size: 3
                  - id: stroke_width_stream
                    type: stroke_width_stream
                    size: 8
                  - id: has_stroke_width
                    type: u1
                  - size: 3
                  - id: stroke_stream
                    type: stroke_stream
                    size: 8
                  - id: has_stroke
                    type: u1
                instances:
                  fill:
                    type: js_str
                    io: fill_stream._io
                    pos: 0
                    if: has_fill != 0
                    '-webide-parse-mode': eager
                  line_style:
                    type: line_style
                    io: line_style_stream._io
                    pos: 0
                    if: has_line_style != 0
                    '-webide-parse-mode': eager
                  opacity:
                    type: f8
                    io: opacity_stream._io
                    pos: 0
                    if: has_opacity != 0
                    '-webide-parse-mode': eager
                  stroke:
                    type: js_str
                    io: stroke_stream._io
                    pos: 0
                    if: has_stroke != 0
                    '-webide-parse-mode': eager
                  stroke_width:
                    type: f8
                    io: stroke_width_stream._io
                    pos: 0
                    if: has_stroke_width != 0
                    '-webide-parse-mode': eager
                types:
                  fill_stream:
                    seq:
                      - size: 8
                  line_style:
                    seq:
                      - id: line_style
                        type: u1
                        enum: line_style
                    enums:
                      line_style:
                        '0': empty
                        '1': dashed
                        '2': dotted
                  line_style_stream:
                    seq:
                      - size: 1
                  opacity_stream:
                    seq:
                      - size: 8
                  stroke_stream:
                    seq:
                      - size: 8
                  stroke_width_stream:
                    seq:
                      - size: 8
          variant4:
            seq:
              - id: s
                type: s
              - size: 3
              - id: x
                type: f8
              - id: 'y'
                type: f8
              - id: text
                type: js_str
            types:
              s:
                seq:
                  - id: background_padding_stream
                    type: background_padding_stream
                    size: 8
                  - id: has_background_padding
                    type: u1
                  - size: 3
                  - id: align_stream
                    type: align_stream
                    size: 8
                  - id: has_align
                    type: u1
                  - size: 3
                  - id: opacity_stream
                    type: opacity_stream
                    size: 8
                  - id: has_opacity
                    type: u1
                  - size: 3
                  - id: background_color_stream
                    type: background_color_stream
                    size: 8
                  - id: has_background_color
                    type: u1
                  - size: 3
                  - id: stroke_width_stream
                    type: stroke_width_stream
                    size: 8
                  - id: has_stroke_width
                    type: u1
                  - size: 3
                  - id: color_stream
                    type: color_stream
                    size: 8
                  - id: has_color
                    type: u1
                  - size: 3
                  - id: font_stream
                    type: font_stream
                    size: 8
                  - id: has_font
                    type: u1
                  - size: 3
                  - id: stroke_stream
                    type: stroke_stream
                    size: 8
                  - id: has_stroke
                    type: u1
                instances:
                  align:
                    type: js_str
                    io: align_stream._io
                    pos: 0
                    if: has_align != 0
                    '-webide-parse-mode': eager
                  background_color:
                    type: js_str
                    io: background_color_stream._io
                    pos: 0
                    if: has_background_color != 0
                    '-webide-parse-mode': eager
                  background_padding:
                    type: f8
                    io: background_padding_stream._io
                    pos: 0
                    if: has_background_padding != 0
                    '-webide-parse-mode': eager
                  color:
                    type: js_str
                    io: color_stream._io
                    pos: 0
                    if: has_color != 0
                    '-webide-parse-mode': eager
                  font:
                    type: js_str
                    io: font_stream._io
                    pos: 0
                    if: has_font != 0
                    '-webide-parse-mode': eager
                  opacity:
                    type: f8
                    io: opacity_stream._io
                    pos: 0
                    if: has_opacity != 0
                    '-webide-parse-mode': eager
                  stroke:
                    type: js_str
                    io: stroke_stream._io
                    pos: 0
                    if: has_stroke != 0
                    '-webide-parse-mode': eager
                  stroke_width:
                    type: f8
                    io: stroke_width_stream._io
                    pos: 0
                    if: has_stroke_width != 0
                    '-webide-parse-mode': eager
                types:
                  align_stream:
                    seq:
                      - size: 8
                  background_color_stream:
                    seq:
                      - size: 8
                  background_padding_stream:
                    seq:
                      - size: 8
                  color_stream:
                    seq:
                      - size: 8
                  font_stream:
                    seq:
                      - size: 8
                  opacity_stream:
                    seq:
                      - size: 8
                  stroke_stream:
                    seq:
                      - size: 8
                  stroke_width_stream:
                    seq:
                      - size: 8
