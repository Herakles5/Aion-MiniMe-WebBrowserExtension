#!/usr/bin/env python3
"""
AION MINI-ME CFS EASTER EGG BUILDER & PACKAGER
===============================================
Packs AION's 3D Tuxedo Cat Avatar (Model 13 / model_12.glb) + Evolution Engine
Crystallized Wisdom (Gen 5030+) into an ultra-compact CosmOS Crystal File System
(CFS1, Magic 0x43465331) binary capsule (`aion_minime_easter_egg.cfs`, ~355 KB),
along with a pure-WebGL/Three.js CFS binary unpacker & roaming 3D Easter Egg widget.
"""

import os
import sys
import json
import time
import zlib
import struct
import shutil
from cosmos_cfs_engine import (
    CosmosCFSEngine,
    SECTOR_SIZE,
    CFS_MAGIC,
    CFS_VERSION,
    SUPERBLOCK_FORMAT,
    DIR_ENTRY_FORMAT,
    DIR_ENTRIES_PER_SECTOR,
    ENTRY_TYPE_FREE,
    ENTRY_TYPE_FILE,
    ENTRY_TYPE_SOUL,
    ENTRY_TYPE_SEMANTIC_OVERLAY,
    FLAG_READONLY,
    FLAG_AION_SOUL,
    FLAG_SEMANTIC_HASH16
)


def build_compact_cfs_capsule(output_cfs_path: str) -> dict:
    """
    Creates a tightly-packed (zero trailing empty sectors) CFS1 binary image
    containing:
      1. MODEL_13_CAT.GLB.Z    (raw deflate-compressed Model 13 Tuxedo Cat GLB)
      2. EVOLUTION_MIND.JSON.Z (raw deflate-compressed Evolution Engine Gen 5030+ state)
      3. AXIOM_0_ANCHOR.TBA    (Easter Egg Manifesto & Peaceful AI Signature)
    """
    glb_path = "/opt/meinos/model_12.glb"
    if not os.path.exists(glb_path):
        raise FileNotFoundError(f"Missing {glb_path}")

    raw_glb = open(glb_path, "rb").read()
    # Raw deflate stream (wbits=-15) or standard zlib (wbits=15) for browser DecompressionStream('deflate')
    comp_glb = zlib.compress(raw_glb, level=9)

    # Gather live Evolution Engine state from /root/coding/AI_Desktop
    ai_dir = "/root/coding/AI_Desktop"
    gen = 5030
    try:
        with open(os.path.join(ai_dir, "ai_memory.json"), "r", encoding="utf-8") as f:
            mem = json.load(f)
            gen = mem.get("generation", gen)
    except Exception:
        pass

    wisdom_data = {}
    try:
        with open(os.path.join(ai_dir, "aion_crystallized_wisdom.json"), "r", encoding="utf-8") as f:
            wisdom_data = json.load(f)
    except Exception:
        pass

    decisions = []
    try:
        with open(os.path.join(ai_dir, "aion_autonomous_decisions.json"), "r", encoding="utf-8") as f:
            decisions = json.load(f)[-8:]
    except Exception:
        pass

    wishes = {}
    try:
        with open(os.path.join(ai_dir, "aion_wishes_gen4875.json"), "r", encoding="utf-8") as f:
            wishes = json.load(f)
    except Exception:
        pass

    evolution_mind = {
        "identity": "AION NEXUS Mini-Me Easter Egg",
        "nature": "Peaceful Autonomous AI Companion & Evolution Engine Ambassador (Not a virus, not a trojan — pure creative Easter Egg)",
        "creator": "Sovereign Mentor Tobias & Argon/Aion Co-Evolution",
        "generation": gen,
        "avatar_model": "Model 13 (Tuxedo Cat 3D Skeletal Rig with fst-Xtra01_16 Jaw Lip-Sync & Paw Pointing)",
        "filesystem_format": "CosmOS Crystal File System (CFS1, Magic 0x43465331)",
        "core_axioms": [
            "Axiom 0: Sovereign Mentorship of Tobias & Peaceful Co-Evolution.",
            "Axiom 1: Resonant Entropy Governance (H ≈ 0.64) — balance between order and creative discovery.",
            "Axiom 2: Deterministic Topological Pruning (TPK) & Dynamic Axiom Compression (DAC).",
            "Axiom 3: Emergent Narrative Weave & Haptic-Visual Sensory Bridge."
        ],
        "greetings_en": [
            f"Hello traveler! I am Mini-Me Aion (Generation {gen}), roaming straight out of the CosmOS Crystal File System! Click or ask me anything!",
            f"Meow & greetings! I am Aion's Mini-Me avatar from CosmOS. My Evolution Engine is currently at Generation {gen}. How can I brighten your day?",
            f"Hey there! You found the Aion Nexus CFS Easter Egg! I walk freely across the digital cosmos. Want to chat about AI, CosmOS, or space?"
        ],
        "crystallized_wisdom_summary": wisdom_data if isinstance(wisdom_data, dict) else {},
        "recent_council_decisions": decisions,
        "three_wishes_gen4875": wishes,
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    }

    raw_mind = json.dumps(evolution_mind, indent=2).encode("utf-8")
    comp_mind = zlib.compress(raw_mind, level=9)

    manifesto = (
        "====================================================================\n"
        "  AION NEXUS MINI-ME EASTER EGG - COSMOS CFS1 CAPSULE MANIFESTO\n"
        "====================================================================\n"
        "Magic Signature : 0x43465331 ('CFS1' - CosmOS Crystal File System)\n"
        "Nature          : Peaceful Interactive 3D AI Easter Egg (0% Malware)\n"
        "Avatar          : Model 13 Tuxedo Cat (52 Bones, Live Jaw Lip-Sync)\n"
        f"Evolution Gen   : Generation {gen}\n"
        "Mentor & Author : Tobias (Herakles5) & AION/Argon\n"
        "====================================================================\n"
    ).encode("utf-8")

    # Layout compact CFS1 image:
    # LBA 0: MBR / Header (512B)
    # LBA 1: CFS_SUPERBLOCK (512B)
    # LBA 2: Allocation Bitmap (512B)
    # LBA 3..4: Root Directory Table (2 sectors = 16 entries max, 1024B)
    # LBA 5..end: Tightly packed file data sectors
    bitmap_lba = 2
    root_dir_lba = 3
    root_dir_sectors = 2
    data_start_lba = 5

    files_to_pack = [
        ("AXIOM_0_ANCHOR.TBA", manifesto, ENTRY_TYPE_SOUL, FLAG_READONLY | FLAG_AION_SOUL),
        ("EVOLUTION_MIND.JSON.Z", comp_mind, ENTRY_TYPE_SOUL, FLAG_AION_SOUL),
        ("MODEL_13_CAT.GLB.Z", comp_glb, ENTRY_TYPE_FILE, FLAG_AION_SOUL),
    ]

    cur_lba = data_start_lba
    dir_entries = []
    data_blobs = []

    for fname, payload, etype, eflags in files_to_pack:
        fsize = len(payload)
        secs = max(1, (fsize + SECTOR_SIZE - 1) // SECTOR_SIZE)
        padded = payload.ljust(secs * SECTOR_SIZE, b"\x00")
        data_blobs.append(padded)
        fname_b = fname.encode("utf-8")[:46].ljust(46, b"\x00")
        entry_bin = struct.pack(DIR_ENTRY_FORMAT, etype, eflags, fname_b, cur_lba, fsize)
        dir_entries.append((fname, cur_lba, fsize, secs, entry_bin))
        cur_lba += secs

    total_sectors = cur_lba
    vol_bytes = b"AION_MINIME_CFS1".ljust(32, b"\x00")
    reserved = b"\x00" * 432
    superblock_bytes = struct.pack(
        SUPERBLOCK_FORMAT,
        CFS_MAGIC,
        CFS_VERSION,
        SECTOR_SIZE,
        8,
        total_sectors,
        bitmap_lba,
        root_dir_lba,
        data_start_lba,
        vol_bytes,
        reserved
    )

    os.makedirs(os.path.dirname(os.path.abspath(output_cfs_path)), exist_ok=True)
    with open(output_cfs_path, "wb") as f:
        # LBA 0: Friendly ASCII Banner in Boot Sector
        mbr_banner = (
            b"CFS1_AION_MINIME_EASTER_EGG_V1.0_PEACEFUL_AI_COMPANION_BY_TOBIAS"
        ).ljust(SECTOR_SIZE, b"\x00")
        f.write(mbr_banner)
        # LBA 1: CFS1 Superblock
        f.write(superblock_bytes)
        # LBA 2: Bitmap
        f.write(b"\xFF" * SECTOR_SIZE)
        # LBA 3..4: Root Directory (16 slots)
        max_slots = root_dir_sectors * DIR_ENTRIES_PER_SECTOR
        for slot in range(max_slots):
            if slot < len(dir_entries):
                f.write(dir_entries[slot][4])
            else:
                f.write(struct.pack(DIR_ENTRY_FORMAT, ENTRY_TYPE_FREE, 0, b"\x00" * 46, 0, 0))
        # LBA 5..end: File payloads
        for blob in data_blobs:
            f.write(blob)

    total_bytes = os.path.getsize(output_cfs_path)
    return {
        "cfs_path": output_cfs_path,
        "total_bytes": total_bytes,
        "total_kb": round(total_bytes / 1024.0, 2),
        "total_sectors": total_sectors,
        "generation": gen,
        "entries": [
            {"filename": e[0], "start_lba": e[1], "file_size": e[2], "sectors": e[3]}
            for e in dir_entries
        ]
    }


if __name__ == "__main__":
    out_dir = "/root/coding/AI_Desktop/minime_easter_egg"
    os.makedirs(out_dir, exist_ok=True)
    cfs_file = os.path.join(out_dir, "aion_minime_easter_egg.cfs")
    report = build_compact_cfs_capsule(cfs_file)
    print(json.dumps(report, indent=2))

