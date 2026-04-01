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
      - '0x38'
      - '0x9c'
      - '0xe6'
      - '0x72'
  - id: size
    type: u4
  - id: zero
    contents:
      - 0
      - 0
      - 0
      - 0
  - id: value
    type: room
types:
  action_log:
    seq:
      - id: action_log_ofs
        type: u4
      - id: action_log_len
        type: s4
    instances:
      action_log:
        type: action_log_t
        io: _root._io
        pos: action_log_ofs
        repeat: expr
        repeat-expr: action_log_len
        '-webide-parse-mode': eager
    types:
      action_log_t:
        seq:
          - id: time
            type: s4
          - id: type
            type: u1
            enum: type
          - id: x
            type: s1
          - id: 'y'
            type: s1
        enums:
          type:
            '0': harvest
            '1': reaction1
            '2': reaction2
            '3': reverse_reaction1
            '4': reverse_reaction2
            '5': attack
            '6': attacked
            '7': heal
            '8': healed
            '9': ranged_attack
            '10': ranged_heal
            '11': ranged_mass_attack
            '12': build
            '13': repair
            '14': produce
            '15': transfer_energy
            '16': reserve_controller
            '17': upgrade_controller
  any_object:
    seq:
      - id: any_object_ofs
        type: u4
      - id: any_object_type
        type: u1
      - size: any_object_ofs - _io.pos
      - id: any_object
        type:
          switch-on: any_object_type
          cases:
            '0': ruin
            '1': container
            '2': resource
            '3': creep
            '4': tombstone
            '5': extractor
            '6': mineral
            '7': lab
            '8': rampart
            '9': tower
            '10': wall
            '11': construction_site
            '12': structure_factory
            '13': link
            '14': storage
            '15': structure_terminal
            '16': observer
            '17': observer_spy
            '18': road
            '19': source
            '20': keeper_lair
            '21': controller
            '22': extension
            '23': spawn
  buffer:
    seq:
      - id: buffer_ofs
        type: u4
      - id: buffer_len
        type: u4
    instances:
      buffer:
        io: _root._io
        pos: buffer_ofs
        size: buffer_len
        '-webide-parse-mode': eager
  construction_site:
    seq:
      - id: super
        type: room_object
      - id: user
        type: id
      - id: name
        type: js_str
      - id: progress
        type: s4
      - id: structure_type
        type: u1
        enum: structure_type
    enums:
      structure_type:
        '0': container
        '1': extractor
        '2': lab
        '3': rampart
        '4': tower
        '5': constructed_wall
        '6': factory
        '7': link
        '8': storage
        '9': terminal
        '10': observer
        '11': road
        '12': extension
        '13': spawn
  container:
    seq:
      - id: super
        type: structure
      - id: store
        type: open_store
      - id: next_decay_time
        type: s4
      - id: hits
        type: s4
  controller:
    seq:
      - id: super
        type: owned_structure
      - id: downgrade_time
        type: s4
      - id: progress
        type: s4
      - id: reservation_end_time
        type: s4
      - id: safe_mode_cooldown_time
        type: s4
      - id: upgrade_blocked_until
        type: s4
      - id: safe_mode_available
        type: s4
      - id: is_power_enabled
        type: s1
  creep:
    seq:
      - id: super
        type: room_object
      - id: user
        type: id
      - id: store
        type: open_store
      - id: action_log
        type: action_log
      - id: body_ofs
        type: u4
      - id: body_len
        type: s4
      - id: name
        type: js_str
      - id: age_time
        type: s4
      - id: saying_ofs
        type: u4
      - id: fatigue
        type: s4
      - id: hits
        type: s4
    instances:
      body:
        type: body_t
        io: _root._io
        pos: body_ofs
        repeat: expr
        repeat-expr: body_len
        '-webide-parse-mode': eager
      saying:
        type: saying
        io: _root._io
        pos: saying_ofs
        if: saying_ofs > 0
        '-webide-parse-mode': eager
    types:
      body_t:
        seq:
          - id: boost
            type: resource_type
          - id: hits
            type: s1
          - id: type
            type: u1
            enum: type
        enums:
          type:
            '0': move
            '1': work
            '2': carry
            '3': attack
            '4': ranged_attack
            '5': tough
            '6': heal
            '7': claim
      saying:
        seq:
          - id: message
            type: js_str
          - id: time
            type: s4
          - id: is_public
            type: s1
  extension:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: single_store
      - size: 3
      - id: hits
        type: s4
  extractor:
    seq:
      - id: super
        type: owned_structure
      - id: cooldown_time
        type: s4
      - id: hits
        type: s4
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
  keeper_lair:
    seq:
      - id: super
        type: owned_structure
      - id: next_spawn_time
        type: s4
  lab:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: store
      - size: 3
      - id: action_log
        type: action_log
      - id: cooldown_time
        type: s4
      - id: hits
        type: s4
    types:
      store:
        seq:
          - id: energy
            type: s4
          - id: mineral_amount
            type: s4
          - id: mineral_type
            type: resource_type
  link:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: single_store
      - size: 3
      - id: action_log
        type: action_log
      - id: cooldown_time
        type: s4
      - id: hits
        type: s4
  mineral:
    seq:
      - id: super
        type: room_object
      - id: next_regeneration_time
        type: s4
      - id: density
        type: s4
      - id: mineral_amount
        type: s4
      - id: mineral_type
        type: resource_type
  observer:
    seq:
      - id: super
        type: owned_structure
      - id: hits
        type: s4
  observer_spy:
    seq:
      - id: super
        type: room_object
      - id: user
        type: id
  open_store:
    seq:
      - id: resources_ofs
        type: u4
      - id: resources_len
        type: s4
      - id: capacity
        type: s4
    instances:
      resources:
        type: resources_t
        io: _root._io
        pos: resources_ofs
        repeat: expr
        repeat-expr: resources_len
        '-webide-parse-mode': eager
    types:
      resources_t:
        seq:
          - id: amount
            type: s4
          - id: type
            type: resource_type
  owned_structure:
    seq:
      - id: super
        type: structure
      - id: user
        type: id
  rampart:
    seq:
      - id: super
        type: owned_structure
      - id: next_decay_time
        type: s4
      - id: hits
        type: s4
      - id: is_public
        type: s1
  resource:
    seq:
      - id: super
        type: room_object
      - id: amount
        type: s4
      - id: resource_type
        type: resource_type
  resource_type:
    seq:
      - id: resource_type
        type: u1
        enum: resource_type
    enums:
      resource_type:
        '0': empty
        '1': energy
        '2': power
        '3': h
        '4': o
        '5': u
        '6': l
        '7': k
        '8': z
        '9': x
        '10': g
        '11': oh
        '12': zk
        '13': ul
        '14': uh
        '15': uo
        '16': kh
        '17': ko
        '18': lh
        '19': lo
        '20': zh
        '21': zo
        '22': gh
        '23': go
        '24': uh2o
        '25': uho2
        '26': kh2o
        '27': kho2
        '28': lh2o
        '29': lho2
        '30': zh2o
        '31': zho2
        '32': gh2o
        '33': gho2
        '34': xuh2o
        '35': xuho2
        '36': xkh2o
        '37': xkho2
        '38': xlh2o
        '39': xlho2
        '40': xzh2o
        '41': xzho2
        '42': xgh2o
        '43': xgho2
        '44': utrium_bar
        '45': lemergium_bar
        '46': zynthium_bar
        '47': keanium_bar
        '48': ghodium_melt
        '49': oxidant
        '50': reductant
        '51': purifier
        '52': battery
        '53': silicon
        '54': metal
        '55': biomass
        '56': mist
        '57': ops
        '58': composite
        '59': crystal
        '60': liquid
        '61': wire
        '62': switch
        '63': transistor
        '64': microchip
        '65': circuit
        '66': device
        '67': cell
        '68': phlegm
        '69': tissue
        '70': muscle
        '71': organoid
        '72': organism
        '73': alloy
        '74': tube
        '75': fixtures
        '76': frame
        '77': hydraulics
        '78': machine
        '79': condensate
        '80': concentrate
        '81': extract
        '82': spirit
        '83': emanation
        '84': essence
  road:
    seq:
      - id: super
        type: structure
      - id: next_decay_time
        type: s4
      - id: hits
        type: s4
      - id: terrain
        type: s1
  room:
    seq:
      - id: users
        type: users
      - id: npc_data
        type: npc_data
      - id: name
        type: js_str
      - id: cumulative_energy_harvested
        type: s4
      - id: event_log_ofs
        type: u4
      - id: invader_energy_target
        type: s4
      - id: level
        type: s4
      - id: objects_ofs
        type: u4
      - id: safe_mode_until
        type: s4
      - id: sign_ofs
        type: u4
      - id: user_ofs
        type: u4
    instances:
      event_log:
        type: event_log
        io: _root._io
        pos: event_log_ofs - 4
        if: event_log_ofs > 0
        repeat: until
        repeat-until: _.next_ofs == 0
        '-webide-parse-mode': eager
      objects:
        type: objects
        io: _root._io
        pos: objects_ofs - 4
        if: objects_ofs > 0
        repeat: until
        repeat-until: _.next_ofs == 0
        '-webide-parse-mode': eager
      sign:
        type: sign
        io: _root._io
        pos: sign_ofs
        if: sign_ofs > 0
        '-webide-parse-mode': eager
      user:
        type: id
        io: _root._io
        pos: user_ofs
        if: user_ofs > 0
        '-webide-parse-mode': eager
    types:
      event_log:
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
              - id: object_id
                type: id
              - id: target_id
                type: id
              - id: amount
                type: s4
            instances:
              event:
                value: 5
                '-webide-parse-mode': eager
          variant1:
            seq:
              - id: object_id
                type: id
              - id: target_id
                type: id
              - id: attack_type
                type: s4
              - id: damage
                type: s4
            instances:
              event:
                value: 1
                '-webide-parse-mode': eager
          variant2:
            seq:
              - id: object_id
                type: id
              - id: target_id
                type: id
              - id: amount
                type: s4
              - id: heal_type
                type: s4
            instances:
              event:
                value: 6
                '-webide-parse-mode': eager
          variant3:
            seq:
              - id: target_id
                type: id
              - id: amount
                type: s4
              - id: energy_spent
                type: s4
            instances:
              event:
                value: 4
                '-webide-parse-mode': eager
          variant4:
            seq:
              - id: object_id
                type: id
              - id: target_id
                type: id
              - id: amount
                type: s4
              - id: energy_spent
                type: s4
            instances:
              event:
                value: 7
                '-webide-parse-mode': eager
      npc_data:
        seq:
          - id: users_ofs
            type: u4
          - id: users_len
            type: s4
          - id: memory_ofs
            type: u4
        instances:
          memory:
            type: memory
            io: _root._io
            pos: memory_ofs - 4
            if: memory_ofs > 0
            repeat: until
            repeat-until: _.next_ofs == 0
            '-webide-parse-mode': eager
          users:
            type: id
            io: _root._io
            pos: users_ofs
            repeat: expr
            repeat-expr: users_len
            '-webide-parse-mode': eager
        types:
          memory:
            seq:
              - id: next_ofs
                type: u4
              - id: value
                type: value
              - size: 'next_ofs == 0 ? 0 : next_ofs - _io.pos - 4'
            types:
              value:
                seq:
                  - id: id
                    type: id
                  - id: memory
                    type: buffer
      objects:
        seq:
          - id: next_ofs
            type: u4
          - id: value
            type: any_object
          - size: 'next_ofs == 0 ? 0 : next_ofs - _io.pos - 4'
      sign:
        seq:
          - id: user_id
            type: id
          - id: datetime
            type: f8
          - id: text
            type: js_str
          - id: time
            type: s4
      users:
        seq:
          - id: extra_ofs
            type: u4
          - id: extra_len
            type: s4
          - id: intents_ofs
            type: u4
          - id: intents_len
            type: s4
          - id: presence_ofs
            type: u4
          - id: presence_len
            type: s4
          - id: vision_ofs
            type: u4
          - id: vision_len
            type: s4
        instances:
          extra:
            type: id
            io: _root._io
            pos: extra_ofs
            repeat: expr
            repeat-expr: extra_len
            '-webide-parse-mode': eager
          intents:
            type: id
            io: _root._io
            pos: intents_ofs
            repeat: expr
            repeat-expr: intents_len
            '-webide-parse-mode': eager
          presence:
            type: id
            io: _root._io
            pos: presence_ofs
            repeat: expr
            repeat-expr: presence_len
            '-webide-parse-mode': eager
          vision:
            type: id
            io: _root._io
            pos: vision_ofs
            repeat: expr
            repeat-expr: vision_len
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
  ruin:
    seq:
      - id: super
        type: room_object
      - id: structure
        type: structure
      - id: store
        type: open_store
      - id: decay_time
        type: s4
      - id: destroy_time
        type: s4
    types:
      structure:
        seq:
          - id: id
            type: id
          - id: user
            type: id
          - id: type
            type: js_str
          - id: hits_max
            type: s4
  single_store:
    seq:
      - id: amount
        type: s4
      - id: capacity
        type: s4
      - id: type
        type: resource_type
  source:
    seq:
      - id: super
        type: room_object
      - id: next_regeneration_time
        type: s4
      - id: energy
        type: s4
      - id: energy_capacity
        type: s4
  spawn:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: single_store
      - size: 3
      - id: name
        type: js_str
      - id: hits
        type: s4
      - id: spawning_ofs
        type: u4
    instances:
      spawning:
        type: spawning
        io: _root._io
        pos: spawning_ofs
        if: spawning_ofs > 0
        '-webide-parse-mode': eager
    types:
      spawning:
        seq:
          - id: spawn_id
            type: id
          - id: spawning_creep_id
            type: id
          - id: directions_stream
            type: directions_stream
            size: 8
          - id: has_directions
            type: u1
          - size: 3
          - id: spawn_time
            type: s4
          - id: need_time
            type: s4
        instances:
          directions:
            type: directions
            io: directions_stream._io
            pos: 0
            if: has_directions != 0
            '-webide-parse-mode': eager
        types:
          directions:
            seq:
              - id: directions_ofs
                type: u4
              - id: directions_len
                type: s4
            instances:
              directions:
                type: s1
                io: _root._io
                pos: directions_ofs
                repeat: expr
                repeat-expr: directions_len
                '-webide-parse-mode': eager
          directions_stream:
            seq:
              - size: 8
  storage:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: open_store
      - id: hits
        type: s4
  structure:
    seq:
      - id: structure
        type: room_object
  structure_factory:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: open_store
      - id: action_log
        type: action_log
      - id: cooldown_time
        type: s4
      - id: level
        type: s4
      - id: hits
        type: s4
  structure_terminal:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: open_store
      - id: cooldown_time
        type: s4
      - id: hits
        type: s4
  tombstone:
    seq:
      - id: super
        type: room_object
      - id: creep
        type: creep
      - id: store
        type: open_store
      - id: decay_time
        type: s4
      - id: death_time
        type: s4
    types:
      creep:
        seq:
          - id: id
            type: id
          - id: user
            type: id
          - id: body_ofs
            type: u4
          - id: body_len
            type: s4
          - id: name
            type: js_str
          - id: saying_ofs
            type: u4
          - id: ticks_to_live
            type: s4
        instances:
          body:
            type: body_t
            io: _root._io
            pos: body_ofs
            repeat: expr
            repeat-expr: body_len
            '-webide-parse-mode': eager
          saying:
            type: saying
            io: _root._io
            pos: saying_ofs
            if: saying_ofs > 0
            '-webide-parse-mode': eager
        types:
          body_t:
            seq:
              - id: body_t
                type: u1
                enum: body_t
            enums:
              body_t:
                '0': move
                '1': work
                '2': carry
                '3': attack
                '4': ranged_attack
                '5': tough
                '6': heal
                '7': claim
          saying:
            seq:
              - id: message
                type: js_str
              - id: time
                type: s4
              - id: is_public
                type: s1
  tower:
    seq:
      - id: super
        type: owned_structure
      - id: store
        type: single_store
      - size: 3
      - id: action_log
        type: action_log
      - id: hits
        type: s4
  wall:
    seq:
      - id: super
        type: structure
      - id: hits
        type: s4
