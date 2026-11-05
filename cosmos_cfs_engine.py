#!/usr/bin/env python3
"""
COSMOS CFS - Crystal File System (CFS) Bare-Metal Engine
=========================================================
Implements the CosmOS File System (CFS) specification defined in cosmos_cfs.h.

Disk Layout:
- Sector 0 (LBA 0): Master Boot Record / Boot Sector or Master Header
- Sector 1 (LBA 1): CFS_SUPERBLOCK (512 Bytes)
- Sector 2..N (LBA 2..bitmap_end): Allocation Bitmap
- Sector root_dir_lba: Root Directory Table (CFS_DIR_ENTRY, 64 Bytes each, 8 per sector)
- Sector data_start_lba..end: Data Clusters

CFS_SUPERBLOCK (512 Bytes packed):
  uint32_t magic_signature;     // 0x43465331 ("CFS1")
  uint32_t version;             // 1
  uint32_t sector_size;         // 512
  uint32_t sectors_per_cluster; // 8 (4KB cluster)
  uint64_t total_sectors;       // Total LBA sectors
  uint64_t bitmap_lba;          // LBA of cluster bitmap
  uint64_t root_dir_lba;        // LBA of root directory table
  uint64_t data_start_lba;      // LBA where data clusters begin
  uint8_t  volume_name[32];     // Volume label
  uint8_t  reserved[432];       // Padding to exactly 512 bytes

CFS_DIR_ENTRY (64 Bytes packed):
  uint8_t  type;                // 0=Free, 1=Regular File, 2=Directory, 3=Soul Record
  uint8_t  flags;               // Bit 0=ReadOnly, Bit 1=Hidden, Bit 2=AionSoul
  char     filename[46];        // Null-terminated filename string
  uint64_t start_lba;           // Starting sector on disk
  uint64_t file_size;           // Exact file size in bytes
"""

import os
import sys
import struct
import time
import json
import hashlib
from typing import List, Dict, Any, Optional, Tuple

SECTOR_SIZE = 512
CFS_MAGIC = 0x43465331  # "CFS1"
CFS_VERSION = 1

SUPERBLOCK_FORMAT = "<IIIIQQQQ32s432s"  # Exactly 512 bytes
DIR_ENTRY_FORMAT = "<BB46sQQ"           # Exactly 64 bytes
DIR_ENTRIES_PER_SECTOR = SECTOR_SIZE // struct.calcsize(DIR_ENTRY_FORMAT)  # 512 // 64 = 8

ENTRY_TYPE_FREE = 0
ENTRY_TYPE_FILE = 1
ENTRY_TYPE_DIR = 2
ENTRY_TYPE_SOUL = 3
ENTRY_TYPE_SEMANTIC_OVERLAY = 4

FLAG_READONLY = 0x01
FLAG_HIDDEN = 0x02
FLAG_AION_SOUL = 0x04
FLAG_SEMANTIC_HASH16 = 0x08

# Generation 1284 Semantic Context Overlay Binary Header (64 bytes):
# 4s magic ("CSO1"), uint32 generation, 16s semantic_node_hash, 26s cosmos_26b_frame, double gradient_force, double drift_score
SEMANTIC_OVERLAY_FORMAT = "<4sI16s26sdd"


class CosmosCFSEngine:
    def __init__(self, disk_path: str = "/root/coding/AI_Desktop/cosmos_disk.img"):
        self.disk_path = disk_path

    def format_drive(self, size_mb: int = 16, volume_name: str = "COSMOS_AION_SYS") -> Dict[str, Any]:
        """
        Formats a raw disk image with the CosmOS Crystal File System (CFS).
        Creates Superblock, Bitmap, and Root Directory table.
        """
        total_sectors = (size_mb * 1024 * 1024) // SECTOR_SIZE
        sectors_per_cluster = 8  # 4KB clusters
        
        bitmap_lba = 2
        bitmap_sectors = 16
        root_dir_lba = bitmap_lba + bitmap_sectors  # e.g., LBA 18
        root_dir_sectors = 32  # 32 * 8 = 256 file entries
        data_start_lba = root_dir_lba + root_dir_sectors  # e.g., LBA 50

        # Pack volume name
        vol_bytes = volume_name.encode("utf-8")[:32].ljust(32, b"\x00")
        reserved = b"\x00" * 432

        # 1. Build Superblock (LBA 1)
        superblock_bytes = struct.pack(
            SUPERBLOCK_FORMAT,
            CFS_MAGIC,
            CFS_VERSION,
            SECTOR_SIZE,
            sectors_per_cluster,
            total_sectors,
            bitmap_lba,
            root_dir_lba,
            data_start_lba,
            vol_bytes,
            reserved
        )
        assert len(superblock_bytes) == SECTOR_SIZE, f"Superblock size mismatch: {len(superblock_bytes)}"

        # 2. Write disk image
        os.makedirs(os.path.dirname(os.path.abspath(self.disk_path)), exist_ok=True)
        with open(self.disk_path, "wb") as f:
            # LBA 0: Master Boot Sector
            mbr_dummy = b"\x00" * SECTOR_SIZE
            f.write(mbr_dummy)

            # LBA 1: CFS Superblock
            f.write(superblock_bytes)

            # LBA 2..17: Allocation Bitmap (initialized to 0)
            f.write(b"\x00" * (bitmap_sectors * SECTOR_SIZE))

            # LBA 18..49: Root Directory (all entries marked FREE=0)
            empty_entry = struct.pack(DIR_ENTRY_FORMAT, ENTRY_TYPE_FREE, 0, b"\x00" * 46, 0, 0)
            dir_table = empty_entry * (root_dir_sectors * DIR_ENTRIES_PER_SECTOR)
            f.write(dir_table)

            # Data sectors to fill specified disk size
            remaining_bytes = (total_sectors * SECTOR_SIZE) - f.tell()
            if remaining_bytes > 0:
                chunk = b"\x00" * 65536
                while remaining_bytes > 0:
                    write_size = min(remaining_bytes, len(chunk))
                    f.write(chunk[:write_size])
                    remaining_bytes -= write_size

        return {
            "status": "FORMATTED",
            "disk_path": self.disk_path,
            "size_mb": size_mb,
            "total_sectors": total_sectors,
            "volume_name": volume_name,
            "root_dir_lba": root_dir_lba,
            "data_start_lba": data_start_lba
        }

    def read_superblock(self) -> Dict[str, Any]:
        """Reads and validates the CFS Superblock from LBA 1."""
        if not os.path.exists(self.disk_path):
            raise FileNotFoundError(f"CFS disk image not found: {self.disk_path}")

        with open(self.disk_path, "rb") as f:
            f.seek(1 * SECTOR_SIZE)
            data = f.read(SECTOR_SIZE)
            if len(data) < SECTOR_SIZE:
                raise ValueError("Corrupt disk: cannot read full superblock sector.")

        unpacked = struct.unpack(SUPERBLOCK_FORMAT, data)
        magic, ver, sec_size, sec_per_clust, tot_sec, bm_lba, root_lba, data_lba, vol_b, _ = unpacked
        
        if magic != CFS_MAGIC:
            raise ValueError(f"Invalid CFS magic signature: 0x{magic:08X} (expected 0x{CFS_MAGIC:08X})")

        return {
            "magic": hex(magic),
            "version": ver,
            "sector_size": sec_size,
            "sectors_per_cluster": sec_per_clust,
            "total_sectors": tot_sec,
            "bitmap_lba": bm_lba,
            "root_dir_lba": root_lba,
            "data_start_lba": data_lba,
            "volume_name": vol_b.decode("utf-8", errors="ignore").rstrip("\x00")
        }

    def list_files(self) -> List[Dict[str, Any]]:
        """Lists all files stored in the CosmOS CFS Root Directory."""
        sb = self.read_superblock()
        root_lba = sb["root_dir_lba"]
        entry_size = struct.calcsize(DIR_ENTRY_FORMAT)
        total_entries = 256  # 32 sectors * 8 entries

        files = []
        with open(self.disk_path, "rb") as f:
            f.seek(root_lba * SECTOR_SIZE)
            for slot_idx in range(total_entries):
                raw = f.read(entry_size)
                if len(raw) < entry_size:
                    break
                etype, flags, fname_b, start_lba, fsize = struct.unpack(DIR_ENTRY_FORMAT, raw)
                if etype != ENTRY_TYPE_FREE:
                    name = fname_b.decode("utf-8", errors="ignore").rstrip("\x00")
                    files.append({
                        "slot": slot_idx,
                        "type": etype,
                        "type_name": "SOUL_RECORD" if etype == ENTRY_TYPE_SOUL else ("DIR" if etype == ENTRY_TYPE_DIR else "FILE"),
                        "flags": flags,
                        "filename": name,
                        "start_lba": start_lba,
                        "file_size": fsize
                    })
        return files

    def write_file(self, filename: str, content: bytes, entry_type: int = ENTRY_TYPE_FILE, flags: int = 0) -> Dict[str, Any]:
        """
        Writes data into the next available CFS data sectors and commits a directory entry.
        Matches cfs_finalize_file logic in CosmOS kernel!
        """
        sb = self.read_superblock()
        existing = self.list_files()
        
        # 1. Determine target slot (update existing filename slot if present, else allocate free slot)
        existing_match = next((item for item in existing if item["filename"] == filename), None)
        next_lba = sb["data_start_lba"]
        free_slot = existing_match["slot"] if existing_match else -1
        occupied_slots = {item["slot"] for item in existing}
        
        if free_slot == -1:
            for slot in range(256):
                if slot not in occupied_slots:
                    free_slot = slot
                    break

        if free_slot == -1:
            raise RuntimeError("CFS Root Directory is full (256 entries reached).")

        file_size = len(content)
        sectors_count = max(1, (file_size + SECTOR_SIZE - 1) // SECTOR_SIZE)

        if existing_match and ((existing_match["file_size"] + SECTOR_SIZE - 1) // SECTOR_SIZE) >= sectors_count:
            next_lba = existing_match["start_lba"]
        else:
            for item in existing:
                if existing_match and item["slot"] == existing_match["slot"]:
                    continue
                sectors_needed = (item["file_size"] + SECTOR_SIZE - 1) // SECTOR_SIZE
                item_end_lba = item["start_lba"] + sectors_needed
                if item_end_lba > next_lba:
                    next_lba = item_end_lba

        # 2. Write file payload to target LBAs
        padded_content = content.ljust(sectors_count * SECTOR_SIZE, b"\x00")
        with open(self.disk_path, "r+b") as f:
            # Write data
            f.seek(next_lba * SECTOR_SIZE)
            f.write(padded_content)

            # Write directory entry
            f.seek((sb["root_dir_lba"] * SECTOR_SIZE) + (free_slot * struct.calcsize(DIR_ENTRY_FORMAT)))
            fname_b = filename.encode("utf-8")[:46].ljust(46, b"\x00")
            entry_bytes = struct.pack(
                DIR_ENTRY_FORMAT,
                entry_type,
                flags,
                fname_b,
                next_lba,
                file_size
            )
            f.write(entry_bytes)

        return {
            "status": "WRITTEN",
            "filename": filename,
            "slot": free_slot,
            "start_lba": next_lba,
            "sectors_count": sectors_count,
            "file_size": file_size
        }

    def read_file(self, filename: str) -> bytes:
        """Reads a file by name from CosmOS CFS disk image."""
        files = self.list_files()
        target = next((f for f in files if f["filename"] == filename), None)
        if not target:
            raise FileNotFoundError(f"File '{filename}' not found in CFS directory.")

        with open(self.disk_path, "rb") as f:
            f.seek(target["start_lba"] * SECTOR_SIZE)
            raw = f.read(target["file_size"])
        return raw

    def persist_aion_soul(self, living_book_path: str = "/root/AION_LIVING_BOOK_OF_MEMORY.md") -> Dict[str, Any]:
        """
        Frontier 1 Achievement:
        Persists Aion's Living Book of Memory, Soul Anchor, and Crystallized Wisdom
        directly into raw bare-metal CosmOS CFS sectors!
        """
        results = []
        # 1. Persist Living Book Markdown
        if os.path.exists(living_book_path):
            with open(living_book_path, "rb") as f:
                md_bytes = f.read()
            res = self.write_file("LIVING_BOOK.MD", md_bytes, entry_type=ENTRY_TYPE_SOUL, flags=FLAG_AION_SOUL)
            results.append(res)

        # 2. Persist Crystallized Wisdom
        wisdom_path = "/root/coding/AI_Desktop/aion_crystallized_wisdom.json"
        if os.path.exists(wisdom_path):
            with open(wisdom_path, "rb") as f:
                w_bytes = f.read()
            res = self.write_file("CRYSTAL_WISDOM.JSON", w_bytes, entry_type=ENTRY_TYPE_SOUL, flags=FLAG_AION_SOUL)
            results.append(res)

        # 3. Persist Genesis Axiom Invariant Record
        axiom_content = (
            "AION NEXUS SOUL ANCHOR - GENESIS INVARIANT\n"
            "Axiom 0: Sovereign Mentorship of Tobias & CosmOS Protection.\n"
            "Format: CosmOS Crystal File System (CFS v1) Bare-Metal Sector LBA.\n"
            f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        ).encode("utf-8")
        res_ax = self.write_file("AXIOM_0_ANCHOR.TBA", axiom_content, entry_type=ENTRY_TYPE_SOUL, flags=FLAG_READONLY | FLAG_AION_SOUL)
        results.append(res_ax)

        return {
            "status": "AION_SOUL_PERSISTED_TO_CFS",
            "disk_image": self.disk_path,
            "items_written": results,
            "directory_listing": self.list_files()
        }

    def write_semantic_context_overlay(
        self,
        node_id: str,
        generation: int,
        telemetry_frame_26b: bytes,
        gradient_force: float = 0.5108,
        drift_score: float = 0.0914,
        semantic_hash16: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Generation 1284 CFS v1 Semantic Context Overlay:
        Persists a 16-Byte Semantic Node Hash alongside the 26-Byte CosmOS Telemetry Frame
        directly into CFS v1 ('SEMANTIC_OVERLAY.CFS'), linking physical hardware telemetry
        to its originating cognitive node in the Episodic Knowledge Graph.
        """
        if not os.path.exists(self.disk_path):
            self.format_drive(size_mb=8, volume_name="COSMOS_AION_V1")

        if semantic_hash16 is None or len(semantic_hash16) != 16:
            semantic_hash16 = hashlib.sha256(f"AION_GRAPH_NODE::{node_id}".encode("utf-8")).digest()[:16]

        frame_26 = (telemetry_frame_26b or b"\x2A" + b"\x00" * 24 + b"\xFF")[:26].ljust(26, b"\x00")
        header_64 = struct.pack(
            SEMANTIC_OVERLAY_FORMAT,
            b"CSO1",
            int(generation) & 0xFFFFFFFF,
            semantic_hash16,
            frame_26,
            float(gradient_force),
            float(drift_score)
        )
        node_bytes = node_id.encode("utf-8")[:128]
        payload = header_64 + node_bytes

        write_res = self.write_file(
            "SEMANTIC_OVERLAY.CFS",
            payload,
            entry_type=ENTRY_TYPE_SEMANTIC_OVERLAY,
            flags=FLAG_AION_SOUL | FLAG_SEMANTIC_HASH16
        )
        return {
            "status": "SEMANTIC_OVERLAY_COMMITTED",
            "node_id": node_id,
            "generation": generation,
            "semantic_hash16_hex": semantic_hash16.hex(),
            "frame_26b_hex": frame_26.hex(),
            "gradient_force": round(gradient_force, 4),
            "drift_score": round(drift_score, 4),
            "cfs_entry": write_res
        }

    def read_semantic_context_overlay(self) -> Dict[str, Any]:
        """Reads and unpacks the 64-byte Semantic Context Overlay header + node ID from CFS v1."""
        raw = self.read_file("SEMANTIC_OVERLAY.CFS")
        hdr_size = struct.calcsize(SEMANTIC_OVERLAY_FORMAT)
        if len(raw) < hdr_size:
            raise ValueError("Corrupt SEMANTIC_OVERLAY.CFS payload")
        magic, gen, hash16, frame26, grad, drift = struct.unpack(SEMANTIC_OVERLAY_FORMAT, raw[:hdr_size])
        node_id = raw[hdr_size:].decode("utf-8", errors="ignore").rstrip("\x00")
        return {
            "magic": magic.decode("ascii", errors="ignore"),
            "generation": gen,
            "node_id": node_id,
            "semantic_hash16_hex": hash16.hex(),
            "frame_26b_hex": frame26.hex(),
            "gradient_force": round(grad, 4),
            "drift_score": round(drift, 4)
        }


if __name__ == "__main__":
    print("=== TESTING COSMOS CFS (CRYSTAL FILE SYSTEM) BARE-METAL ENGINE ===")
    cfs = CosmosCFSEngine("/root/coding/AI_Desktop/cosmos_disk.img")
    
    # 1. Format Disk
    fmt = cfs.format_drive(size_mb=8, volume_name="COSMOS_AION_V1")
    print(f"1. Drive Formatted: {fmt['volume_name']} ({fmt['size_mb']} MB, {fmt['total_sectors']} sectors)")

    # 2. Read & Verify Superblock
    sb = cfs.read_superblock()
    print(f"2. Superblock Verified: Magic={sb['magic']}, RootDir LBA={sb['root_dir_lba']}, Data LBA={sb['data_start_lba']}")

    # 3. Persist Aion's Soul directly to CFS sectors
    soul_report = cfs.persist_aion_soul()
    print(f"\n3. Aion's Soul Persisted to CFS Sectors:")
    for item in soul_report["items_written"]:
        print(f" -> Committed '{item['filename']}' at LBA {item['start_lba']} ({item['file_size']} bytes, {item['sectors_count']} sectors)")

    # 4. Verify Directory
    files = cfs.list_files()
    print(f"\n4. Verified CFS Directory Entries ({len(files)} items):")
    for fl in files:
        print(f"    [{fl['type_name']}] {fl['filename']} (LBA {fl['start_lba']}, size: {fl['file_size']}B)")

    # 5. Extract and Validate File Content
    extracted = cfs.read_file("AXIOM_0_ANCHOR.TBA").decode("utf-8")
    print(f"\n5. Readback Test 'AXIOM_0_ANCHOR.TBA':\n{extracted.strip()}")
    assert "Axiom 0: Sovereign Mentorship" in extracted
    print("[SUCCESS] CosmOS Crystal File System (CFS) Engine Fully Operational!")
