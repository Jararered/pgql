
com.pokemod.app.public/files/injector/pokemod-injector-arm64:	file format elf64-littleaarch64

Disassembly of section .text:

000000000043b000 <.text>:
  43b088: aa1e03e0     	mov	x0, x30
  43b08c: 94001563     	bl	0x440618 <.text+0x5618>
  43b090: aa0003fe     	mov	x30, x0
  43b094: 5400012b     	b.lt	0x43b0b8 <.text+0xb8>
  43b098: 7100091f     	cmp	w8, #0x2
  43b09c: 5400014d     	b.le	0x43b0c4 <.text+0xc4>
  43b0a0: 34000129     	cbz	w9, 0x43b0c4 <.text+0xc4>
  43b0a4: 7100111f     	cmp	w8, #0x4
  43b0a8: 540000ea     	b.ge	0x43b0c4 <.text+0xc4>
  43b0ac: 90ffe480     	adrp	x0, 0xcb000
  43b0b0: 913d0c00     	add	x0, x0, #0xf43
  43b0b4: 14a447ca     	b	0x2d4cfdc <.text+0x2911fdc>
  43b0b8: 90ffe3e0     	adrp	x0, 0xb7000
  43b0bc: 91061000     	add	x0, x0, #0x184
  43b0c0: 14a447c7     	b	0x2d4cfdc <.text+0x2911fdc>
  43b0c4: 7100091f     	cmp	w8, #0x2
  43b0c8: 7a40d924     	ccmp	w9, #0x0, #0x4, le
  43b0cc: d0ffe529     	adrp	x9, 0xe1000
  43b0d0: 910c2929     	add	x9, x9, #0x30a
  43b0d4: 7a421908     	ccmp	w8, #0x2, #0x8, ne
  43b0d8: f0ffe548     	adrp	x8, 0xe6000
  43b0dc: 911add08     	add	x8, x8, #0x6b7
  43b0e0: 9a88b120     	csel	x0, x9, x8, lt
  43b0e4: 14a447be     	b	0x2d4cfdc <.text+0x2911fdc>
  43b0e8: 90015c68     	adrp	x8, 0x2fc7000
  43b0ec: f0015c89     	adrp	x9, 0x2fce000
  43b0f0: b94dad08     	ldr	w8, [x8, #0xdac]
  43b0f4: b9414929     	ldr	w9, [x9, #0x148]
  43b0f8: 7100091f     	cmp	w8, #0x2
  43b0fc: 7a42d908     	ccmp	w8, #0x2, #0x8, le
  43b100: 7a40a920     	ccmp	w9, #0x0, #0x0, ge
  43b104: 540000c0     	b.eq	0x43b11c <.text+0x11c>
  43b108: 7100091f     	cmp	w8, #0x2
  43b10c: 7a40c924     	ccmp	w9, #0x0, #0x4, gt
  43b110: 7a431900     	ccmp	w8, #0x3, #0x0, ne
  43b114: 540000cd     	b.le	0x43b12c <.text+0x12c>
  43b118: 14001606     	b	0x440930 <.text+0x5930>
  43b11c: f0ffe340     	adrp	x0, 0xa6000
  43b120: 92800001     	mov	x1, #-0x1               // =-1
  43b124: 9133f000     	add	x0, x0, #0xcfc
  43b128: 14a4694c     	b	0x2d55658 <.text+0x291a658>
  43b12c: d0ffe320     	adrp	x0, 0xa1000
  43b130: 92800001     	mov	x1, #-0x1               // =-1
  43b134: 91073000     	add	x0, x0, #0x1cc
  43b138: 14a46948     	b	0x2d55658 <.text+0x291a658>
  43b13c: aa1e03e0     	mov	x0, x30
  43b140: 94001536     	bl	0x440618 <.text+0x5618>
  43b144: aa0003fe     	mov	x30, x0
  43b148: 5400012b     	b.lt	0x43b16c <.text+0x16c>
  43b14c: 7100091f     	cmp	w8, #0x2
  43b150: 5400014d     	b.le	0x43b178 <.text+0x178>
  43b154: 34000129     	cbz	w9, 0x43b178 <.text+0x178>
  43b158: 7100111f     	cmp	w8, #0x4
  43b15c: 540000ea     	b.ge	0x43b178 <.text+0x178>
  43b160: d0ffe4a0     	adrp	x0, 0xd1000
  43b164: 9111f400     	add	x0, x0, #0x47d
  43b168: 14a4479d     	b	0x2d4cfdc <.text+0x2911fdc>
  43b16c: f0ffe500     	adrp	x0, 0xde000
  43b170: 91257400     	add	x0, x0, #0x95d
  43b174: 14a4479a     	b	0x2d4cfdc <.text+0x2911fdc>
  43b178: 7100091f     	cmp	w8, #0x2
  43b17c: 7a40d924     	ccmp	w9, #0x0, #0x4, le
  43b180: d0ffe529     	adrp	x9, 0xe1000
  43b184: 910c2929     	add	x9, x9, #0x30a
  43b188: 7a421908     	ccmp	w8, #0x2, #0x8, ne
  43b18c: d0ffe568     	adrp	x8, 0xe9000
  43b190: 9100ad08     	add	x8, x8, #0x2b
  43b194: 9a88b120     	csel	x0, x9, x8, lt
  43b198: 14a44791     	b	0x2d4cfdc <.text+0x2911fdc>
  43b19c: 90015c68     	adrp	x8, 0x2fc7000
  43b1a0: f0015c89     	adrp	x9, 0x2fce000
  43b1a4: b94dad08     	ldr	w8, [x8, #0xdac]
  43b1a8: b9414929     	ldr	w9, [x9, #0x148]
  43b1ac: 7100091f     	cmp	w8, #0x2
  43b1b0: 7a40a920     	ccmp	w9, #0x0, #0x0, ge
  43b1b4: 7a420900     	ccmp	w8, #0x2, #0x0, eq
  43b1b8: 540001ad     	b.le	0x43b1ec <.text+0x1ec>
  43b1bc: 7100091f     	cmp	w8, #0x2
  43b1c0: 7a40c924     	ccmp	w9, #0x0, #0x4, gt
  43b1c4: 7a431900     	ccmp	w8, #0x3, #0x0, ne
  43b1c8: 5400018d     	b.le	0x43b1f8 <.text+0x1f8>
  43b1cc: 7100091f     	cmp	w8, #0x2
  43b1d0: 540001cb     	b.lt	0x43b208 <.text+0x208>
  43b1d4: 340001a9     	cbz	w9, 0x43b208 <.text+0x208>
  43b1d8: 7100091f     	cmp	w8, #0x2
  43b1dc: 5400016c     	b.gt	0x43b208 <.text+0x208>
  43b1e0: 90ffe480     	adrp	x0, 0xcb000
  43b1e4: 2a1f03e1     	mov	w1, wzr
  43b1e8: 14000006     	b	0x43b200 <.text+0x200>
  43b1ec: 90ffe480     	adrp	x0, 0xcb000
  43b1f0: 528000e1     	mov	w1, #0x7                // =7
  43b1f4: 14000003     	b	0x43b200 <.text+0x200>
  43b1f8: 90ffe480     	adrp	x0, 0xcb000
  43b1fc: 52800021     	mov	w1, #0x1                // =1
  43b200: 913d2c00     	add	x0, x0, #0xf4b
  43b204: 14a447cb     	b	0x2d4d130 <.text+0x2912130>
  43b208: 140015ca     	b	0x440930 <.text+0x5930>
  43b20c: aa1e03e0     	mov	x0, x30
  43b210: 94001502     	bl	0x440618 <.text+0x5618>
  43b214: aa0003fe     	mov	x30, x0
  43b218: 5400012b     	b.lt	0x43b23c <.text+0x23c>
  43b21c: 7100091f     	cmp	w8, #0x2
  43b220: 5400014d     	b.le	0x43b248 <.text+0x248>
  43b224: 34000129     	cbz	w9, 0x43b248 <.text+0x248>
  43b228: 7100111f     	cmp	w8, #0x4
  43b22c: 540000ea     	b.ge	0x43b248 <.text+0x248>
  43b230: f0ffe380     	adrp	x0, 0xae000
  43b234: 912f2c00     	add	x0, x0, #0xbcb
  43b238: 14a44769     	b	0x2d4cfdc <.text+0x2911fdc>
  43b23c: f0ffe4c0     	adrp	x0, 0xd6000
  43b240: 9112d000     	add	x0, x0, #0x4b4
  43b244: 14a44766     	b	0x2d4cfdc <.text+0x2911fdc>
  43b248: 7100091f     	cmp	w8, #0x2
  43b24c: 7a40d924     	ccmp	w9, #0x0, #0x4, le
  43b250: d0ffe529     	adrp	x9, 0xe1000
  43b254: 910c2929     	add	x9, x9, #0x30a
  43b258: 7a421908     	ccmp	w8, #0x2, #0x8, ne
  43b25c: 90ffe3e8     	adrp	x8, 0xb7000
  43b260: 91063908     	add	x8, x8, #0x18e
  43b264: 9a88b120     	csel	x0, x9, x8, lt
  43b268: 14a4475d     	b	0x2d4cfdc <.text+0x2911fdc>
  43b26c: a9bc7bfd     	stp	x29, x30, [sp, #-0x40]!
  43b270: f9000bf7     	str	x23, [sp, #0x10]
  43b274: 910003fd     	mov	x29, sp
  43b278: a90257f6     	stp	x22, x21, [sp, #0x20]
  43b27c: a9034ff4     	stp	x20, x19, [sp, #0x30]
  43b280: 94000018     	bl	0x43b2e0 <.text+0x2e0>
  43b284: 94a40908     	bl	0x2d3d6a4 <.text+0x29026a4>
  43b288: 97ffffad     	bl	0x43b13c <.text+0x13c>
  43b28c: aa0003f3     	mov	x19, x0
  43b290: 97ffffc3     	bl	0x43b19c <.text+0x19c>
  43b294: 94001540     	bl	0x440794 <.text+0x5794>
  43b298: 9400158f     	bl	0x4408d4 <.text+0x58d4>
  43b29c: aa0003f5     	mov	x21, x0
  43b2a0: 97ffffdb     	bl	0x43b20c <.text+0x20c>
  43b2a4: aa0003f6     	mov	x22, x0
  43b2a8: aa1503e0     	mov	x0, x21
  43b2ac: aa1603e1     	mov	x1, x22
  43b2b0: 94001589     	bl	0x4408d4 <.text+0x58d4>
  43b2b4: aa0003f7     	mov	x23, x0
  43b2b8: 940014ba     	bl	0x4405a0 <.text+0x55a0>
  43b2bc: 940014bb     	bl	0x4405a8 <.text+0x55a8>
  43b2c0: 9400146c     	bl	0x440470 <.text+0x5470>
  43b2c4: 9400158c     	bl	0x4408f4 <.text+0x58f4>
  43b2c8: a9434ff4     	ldp	x20, x19, [sp, #0x30]
  43b2cc: aa1703e0     	mov	x0, x23
  43b2d0: a94257f6     	ldp	x22, x21, [sp, #0x20]
  43b2d4: f9400bf7     	ldr	x23, [sp, #0x10]
  43b2d8: a8c47bfd     	ldp	x29, x30, [sp], #0x40
  43b2dc: d65f03c0     	ret
  43b2e0: 90ffe480     	adrp	x0, 0xcb000
  43b2e4: 528003a1     	mov	w1, #0x1d               // =29
  43b2e8: 913d2c00     	add	x0, x0, #0xf4b
  43b2ec: 14a44791     	b	0x2d4d130 <.text+0x2912130>
  43b2f0: a9bb7bfd     	stp	x29, x30, [sp, #-0x50]!
  43b2f4: f9000bf9     	str	x25, [sp, #0x10]
  43b2f8: 910003fd     	mov	x29, sp
  43b2fc: a9025ff8     	stp	x24, x23, [sp, #0x20]
  43b300: a90357f6     	stp	x22, x21, [sp, #0x30]
  43b304: a9044ff4     	stp	x20, x19, [sp, #0x40]
  43b308: b4000580     	cbz	x0, 0x43b3b8 <.text+0x3b8>
  43b30c: aa0003f3     	mov	x19, x0
  43b310: 9400158b     	bl	0x44093c <.text+0x593c>
  43b314: aa0003f4     	mov	x20, x0
  43b318: b0ffe3c0     	adrp	x0, 0xb4000
  43b31c: 9118e000     	add	x0, x0, #0x638
  43b320: 94a4472f     	bl	0x2d4cfdc <.text+0x2911fdc>
  43b324: f0ffe396     	adrp	x22, 0xae000
  43b328: aa0003f5     	mov	x21, x0
  43b32c: aa1f03f9     	mov	x25, xzr
  43b330: 912fbad6     	add	x22, x22, #0xbee
  43b334: aa1303e0     	mov	x0, x19
  43b338: 94ac7332     	bl	0x2f58000 <strlen@plt>
  43b33c: eb20c33f     	cmp	x25, w0, sxtw
  43b340: 540002ca     	b.ge	0x43b398 <.text+0x398>
  43b344: aa1503e0     	mov	x0, x21
  43b348: 94ac732e     	bl	0x2f58000 <strlen@plt>
  43b34c: 1ac00f28     	sdiv	w8, w25, w0
  43b350: 38796a77     	ldrb	w23, [x19, x25]
  43b354: 1b00e501     	msub	w1, w8, w0, w25
  43b358: aa1503e0     	mov	x0, x21
  43b35c: 94000020     	bl	0x43b3dc <.text+0x3dc>
  43b360: 12001c08     	and	w8, w0, #0xff
  43b364: aa1603e0     	mov	x0, x22
  43b368: 4a170101     	eor	w1, w8, w23
  43b36c: 94a44771     	bl	0x2d4d130 <.text+0x2912130>
  43b370: aa0003f7     	mov	x23, x0
  43b374: aa1403e0     	mov	x0, x20
  43b378: aa1703e1     	mov	x1, x23
  43b37c: 94001556     	bl	0x4408d4 <.text+0x58d4>
  43b380: aa0003f8     	mov	x24, x0
  43b384: 9400143b     	bl	0x440470 <.text+0x5470>
  43b388: 940014ed     	bl	0x44073c <.text+0x573c>
  43b38c: 91000739     	add	x25, x25, #0x1
  43b390: aa1803f4     	mov	x20, x24
  43b394: 17ffffe8     	b	0x43b334 <.text+0x334>
  43b398: 94001484     	bl	0x4405a8 <.text+0x55a8>
  43b39c: aa1403e0     	mov	x0, x20
  43b3a0: f9400bf9     	ldr	x25, [sp, #0x10]
  43b3a4: a9444ff4     	ldp	x20, x19, [sp, #0x40]
  43b3a8: a94357f6     	ldp	x22, x21, [sp, #0x30]
  43b3ac: a9425ff8     	ldp	x24, x23, [sp, #0x20]
  43b3b0: a8c57bfd     	ldp	x29, x30, [sp], #0x50
  43b3b4: d65f03c0     	ret
  43b3b8: d0ffe3a0     	adrp	x0, 0xb1000
  43b3bc: f0ffe381     	adrp	x1, 0xae000
  43b3c0: d0ffe362     	adrp	x2, 0xa9000
  43b3c4: 911a5000     	add	x0, x0, #0x694
  43b3c8: 912f5421     	add	x1, x1, #0xbd5
  43b3cc: 9114a042     	add	x2, x2, #0x528
  43b3d0: 94a40e9f     	bl	0x2d3ee4c <.text+0x2903e4c>
  43b3d4: aa1f03f4     	mov	x20, xzr
  43b3d8: 17fffff1     	b	0x43b39c <.text+0x39c>
  43b3dc: a9bf7bfd     	stp	x29, x30, [sp, #-0x10]!
  43b3e0: 910003fd     	mov	x29, sp
  43b3e4: b4000080     	cbz	x0, 0x43b3f4 <.text+0x3f4>
  43b3e8: 38616800     	ldrb	w0, [x0, x1]
  43b3ec: a8c17bfd     	ldp	x29, x30, [sp], #0x10
  43b3f0: d65f03c0     	ret
  43b3f4: d0ffe3a0     	adrp	x0, 0xb1000
  43b3f8: d0ffe2e1     	adrp	x1, 0x99000
  43b3fc: 940013fc     	bl	0x4403ec <.text+0x53ec>
  43b400: 91073421     	add	x1, x1, #0x1cd
  43b404: 940013f2     	bl	0x4403cc <.text+0x53cc>
  43b408: 2a1f03e0     	mov	w0, wzr
  43b40c: 17fffff8     	b	0x43b3ec <.text+0x3ec>
  43b410: d10103ff     	sub	sp, sp, #0x40
  43b414: a9017bfd     	stp	x29, x30, [sp, #0x10]
  43b418: 910043fd     	add	x29, sp, #0x10
  43b41c: a90257f6     	stp	x22, x21, [sp, #0x20]
  43b420: a9034ff4     	stp	x20, x19, [sp, #0x30]
  43b424: b4000c80     	cbz	x0, 0x43b5b4 <.text+0x5b4>
  43b428: aa0103f4     	mov	x20, x1
  43b42c: b4000ce1     	cbz	x1, 0x43b5c8 <.text+0x5c8>
  43b430: aa0203f5     	mov	x21, x2
  43b434: b4000d42     	cbz	x2, 0x43b5dc <.text+0x5dc>
  43b438: aa0303f6     	mov	x22, x3
  43b43c: b4000da3     	cbz	x3, 0x43b5f0 <.text+0x5f0>
  43b440: 940014ab     	bl	0x4406ec <.text+0x56ec>
  43b444: 340000aa     	cbz	w10, 0x43b458 <.text+0x458>
  43b448: 121f7929     	and	w9, w9, #0xfffffffe
  43b44c: 7100093f     	cmp	w9, #0x2
  43b450: 54000341     	b.ne	0x43b4b8 <.text+0x4b8>
  43b454: 34000328     	cbz	w8, 0x43b4b8 <.text+0x4b8>
  43b458: 9400147c     	bl	0x440648 <.text+0x5648>
  43b45c: 34000160     	cbz	w0, 0x43b488 <.text+0x488>
  43b460: d0ffe521     	adrp	x1, 0xe1000
  43b464: aa1503e0     	mov	x0, x21
  43b468: 940013d7     	bl	0x4403c4 <.text+0x53c4>
  43b46c: 340000e0     	cbz	w0, 0x43b488 <.text+0x488>
  43b470: d0ffe521     	adrp	x1, 0xe1000
  43b474: aa1603e0     	mov	x0, x22
  43b478: 940013d3     	bl	0x4403c4 <.text+0x53c4>
  43b47c: 34000060     	cbz	w0, 0x43b488 <.text+0x488>
  43b480: 9400147e     	bl	0x440678 <.text+0x5678>
  43b484: 1400002d     	b	0x43b538 <.text+0x538>
  43b488: 940013c7     	bl	0x4403a4 <.text+0x53a4>
  43b48c: 340000e0     	cbz	w0, 0x43b4a8 <.text+0x4a8>
  43b490: d0ffe521     	adrp	x1, 0xe1000
  43b494: aa1503e0     	mov	x0, x21
  43b498: 940013cb     	bl	0x4403c4 <.text+0x53c4>
  43b49c: 34000060     	cbz	w0, 0x43b4a8 <.text+0x4a8>
  43b4a0: 940014b9     	bl	0x440784 <.text+0x5784>
  43b4a4: 14000025     	b	0x43b538 <.text+0x538>
  43b4a8: 940013bf     	bl	0x4403a4 <.text+0x53a4>
  43b4ac: 34000420     	cbz	w0, 0x43b530 <.text+0x530>
  43b4b0: 9400150b     	bl	0x4408dc <.text+0x58dc>
  43b4b4: 14000021     	b	0x43b538 <.text+0x538>
  43b4b8: 940013bb     	bl	0x4403a4 <.text+0x53a4>
  43b4bc: 34000220     	cbz	w0, 0x43b500 <.text+0x500>
  43b4c0: d0ffe521     	adrp	x1, 0xe1000
  43b4c4: aa1503e0     	mov	x0, x21
  43b4c8: 940013bf     	bl	0x4403c4 <.text+0x53c4>
  43b4cc: 340001a0     	cbz	w0, 0x43b500 <.text+0x500>
  43b4d0: d0ffe521     	adrp	x1, 0xe1000
  43b4d4: aa1603e0     	mov	x0, x22
  43b4d8: 940013bb     	bl	0x4403c4 <.text+0x53c4>
  43b4dc: 34000120     	cbz	w0, 0x43b500 <.text+0x500>
  43b4e0: 94001440     	bl	0x4405e0 <.text+0x55e0>
  43b4e4: 94001433     	bl	0x4405b0 <.text+0x55b0>
  43b4e8: aa0003f5     	mov	x21, x0
  43b4ec: 940014f3     	bl	0x4408b8 <.text+0x58b8>
  43b4f0: 9400149d     	bl	0x440764 <.text+0x5764>
  43b4f4: 94a40ec5     	bl	0x2d3f008 <.text+0x2904008>
  43b4f8: 9400142a     	bl	0x4405a0 <.text+0x55a0>
  43b4fc: 1400000b     	b	0x43b528 <.text+0x528>
  43b500: 940013a9     	bl	0x4403a4 <.text+0x53a4>
  43b504: 34000380     	cbz	w0, 0x43b574 <.text+0x574>
  43b508: d0ffe521     	adrp	x1, 0xe1000
  43b50c: aa1503e0     	mov	x0, x21
  43b510: 940013ad     	bl	0x4403c4 <.text+0x53c4>
  43b514: 34000300     	cbz	w0, 0x43b574 <.text+0x574>
  43b518: 94001432     	bl	0x4405e0 <.text+0x55e0>
  43b51c: 94001425     	bl	0x4405b0 <.text+0x55b0>
  43b520: 940014e8     	bl	0x4408c0 <.text+0x58c0>
  43b524: 94a40eb9     	bl	0x2d3f008 <.text+0x2904008>
  43b528: 94001420     	bl	0x4405a8 <.text+0x55a8>
  43b52c: 14000017     	b	0x43b588 <.text+0x588>
  43b530: aa1303e0     	mov	x0, x19
  43b534: 94a446aa     	bl	0x2d4cfdc <.text+0x2911fdc>
  43b538: aa0003f3     	mov	x19, x0
  43b53c: 94001411     	bl	0x440580 <.text+0x5580>
  43b540: 940014c0     	bl	0x440840 <.text+0x5840>
  43b544: d0015c48     	adrp	x8, 0x2fc5000
  43b548: b89fc3a2     	ldursw	x2, [x29, #-0x4]
  43b54c: 940014ba     	bl	0x440834 <.text+0x5834>
  43b550: 91026114     	add	x20, x8, #0x98
  43b554: aa1403e3     	mov	x3, x20
  43b558: 94ac72ae     	bl	0x2f58010 <fwrite@plt>
  43b55c: aa1403e0     	mov	x0, x20
  43b560: 94ac72b0     	bl	0x2f58020 <fflush@plt>
  43b564: 940014e4     	bl	0x4408f4 <.text+0x58f4>
  43b568: 9400139b     	bl	0x4403d4 <.text+0x53d4>
  43b56c: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b570: 14001413     	b	0x4405bc <.text+0x55bc>
  43b574: 9400138c     	bl	0x4403a4 <.text+0x53a4>
  43b578: 34000120     	cbz	w0, 0x43b59c <.text+0x59c>
  43b57c: 94001419     	bl	0x4405e0 <.text+0x55e0>
  43b580: 94001485     	bl	0x440794 <.text+0x5794>
  43b584: 94a40ea1     	bl	0x2d3f008 <.text+0x2904008>
  43b588: aa1403e0     	mov	x0, x20
  43b58c: 94001392     	bl	0x4403d4 <.text+0x53d4>
  43b590: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b594: 910103ff     	add	sp, sp, #0x40
  43b598: 14a40843     	b	0x2d3d6a4 <.text+0x29026a4>
  43b59c: aa1303e0     	mov	x0, x19
  43b5a0: 97ffff54     	bl	0x43b2f0 <.text+0x2f0>
  43b5a4: 940014d8     	bl	0x440904 <.text+0x5904>
  43b5a8: 94a40e98     	bl	0x2d3f008 <.text+0x2904008>
  43b5ac: aa1303e0     	mov	x0, x19
  43b5b0: 17fffff7     	b	0x43b58c <.text+0x58c>
  43b5b4: 940014b1     	bl	0x440878 <.text+0x5878>
  43b5b8: d0ffe362     	adrp	x2, 0xa9000
  43b5bc: 940014ac     	bl	0x44086c <.text+0x586c>
  43b5c0: 9114d442     	add	x2, x2, #0x535
  43b5c4: 1400000f     	b	0x43b600 <.text+0x600>
  43b5c8: 940014ac     	bl	0x440878 <.text+0x5878>
  43b5cc: 90ffe342     	adrp	x2, 0xa3000
  43b5d0: 940014a7     	bl	0x44086c <.text+0x586c>
  43b5d4: 91310442     	add	x2, x2, #0xc41
  43b5d8: 1400000a     	b	0x43b600 <.text+0x600>
  43b5dc: 940014a7     	bl	0x440878 <.text+0x5878>
  43b5e0: d0ffe562     	adrp	x2, 0xe9000
  43b5e4: 940014a2     	bl	0x44086c <.text+0x586c>
  43b5e8: 9100c042     	add	x2, x2, #0x30
  43b5ec: 14000005     	b	0x43b600 <.text+0x600>
  43b5f0: 940014a2     	bl	0x440878 <.text+0x5878>
  43b5f4: 90ffe582     	adrp	x2, 0xeb000
  43b5f8: 9400149d     	bl	0x44086c <.text+0x586c>
  43b5fc: 91357c42     	add	x2, x2, #0xd5f
  43b600: 94001375     	bl	0x4403d4 <.text+0x53d4>
  43b604: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b608: 14001489     	b	0x44082c <.text+0x582c>
  43b60c: a9be7bfd     	stp	x29, x30, [sp, #-0x20]!
  43b610: a9014ff4     	stp	x20, x19, [sp, #0x10]
  43b614: 910003fd     	mov	x29, sp
  43b618: aa0003f3     	mov	x19, x0
  43b61c: b4000140     	cbz	x0, 0x43b644 <.text+0x644>
  43b620: aa0103f4     	mov	x20, x1
  43b624: b4000081     	cbz	x1, 0x43b634 <.text+0x634>
  43b628: aa1303e0     	mov	x0, x19
  43b62c: 94ac7275     	bl	0x2f58000 <strlen@plt>
  43b630: b9000280     	str	w0, [x20]
  43b634: aa1303e0     	mov	x0, x19
  43b638: a9414ff4     	ldp	x20, x19, [sp, #0x10]
  43b63c: a8c27bfd     	ldp	x29, x30, [sp], #0x20
  43b640: d65f03c0     	ret
  43b644: d0ffe3a0     	adrp	x0, 0xb1000
  43b648: d0ffe461     	adrp	x1, 0xc9000
  43b64c: 94001368     	bl	0x4403ec <.text+0x53ec>
  43b650: 9111f421     	add	x1, x1, #0x47d
  43b654: 9400135e     	bl	0x4403cc <.text+0x53cc>
  43b658: 17fffff7     	b	0x43b634 <.text+0x634>
  43b65c: d10103ff     	sub	sp, sp, #0x40
  43b660: a9017bfd     	stp	x29, x30, [sp, #0x10]
  43b664: 910043fd     	add	x29, sp, #0x10
  43b668: a90257f6     	stp	x22, x21, [sp, #0x20]
  43b66c: a9034ff4     	stp	x20, x19, [sp, #0x30]
  43b670: b4000c80     	cbz	x0, 0x43b800 <.text+0x800>
  43b674: aa0103f4     	mov	x20, x1
  43b678: b4000ce1     	cbz	x1, 0x43b814 <.text+0x814>
  43b67c: aa0203f5     	mov	x21, x2
  43b680: b4000d42     	cbz	x2, 0x43b828 <.text+0x828>
  43b684: aa0303f6     	mov	x22, x3
  43b688: b4000da3     	cbz	x3, 0x43b83c <.text+0x83c>
  43b68c: 94001418     	bl	0x4406ec <.text+0x56ec>
  43b690: 340000aa     	cbz	w10, 0x43b6a4 <.text+0x6a4>
  43b694: 121f7929     	and	w9, w9, #0xfffffffe
  43b698: 7100093f     	cmp	w9, #0x2
  43b69c: 54000341     	b.ne	0x43b704 <.text+0x704>
  43b6a0: 34000328     	cbz	w8, 0x43b704 <.text+0x704>
  43b6a4: 940013e9     	bl	0x440648 <.text+0x5648>
  43b6a8: 34000160     	cbz	w0, 0x43b6d4 <.text+0x6d4>
  43b6ac: d0ffe521     	adrp	x1, 0xe1000
  43b6b0: aa1503e0     	mov	x0, x21
  43b6b4: 94001344     	bl	0x4403c4 <.text+0x53c4>
  43b6b8: 340000e0     	cbz	w0, 0x43b6d4 <.text+0x6d4>
  43b6bc: d0ffe521     	adrp	x1, 0xe1000
  43b6c0: aa1603e0     	mov	x0, x22
  43b6c4: 94001340     	bl	0x4403c4 <.text+0x53c4>
  43b6c8: 34000060     	cbz	w0, 0x43b6d4 <.text+0x6d4>
  43b6cc: 940013eb     	bl	0x440678 <.text+0x5678>
  43b6d0: 1400002d     	b	0x43b784 <.text+0x784>
  43b6d4: 94001334     	bl	0x4403a4 <.text+0x53a4>
  43b6d8: 340000e0     	cbz	w0, 0x43b6f4 <.text+0x6f4>
  43b6dc: d0ffe521     	adrp	x1, 0xe1000
  43b6e0: aa1503e0     	mov	x0, x21
  43b6e4: 94001338     	bl	0x4403c4 <.text+0x53c4>
  43b6e8: 34000060     	cbz	w0, 0x43b6f4 <.text+0x6f4>
  43b6ec: 94001426     	bl	0x440784 <.text+0x5784>
  43b6f0: 14000025     	b	0x43b784 <.text+0x784>
  43b6f4: 9400132c     	bl	0x4403a4 <.text+0x53a4>
  43b6f8: 34000420     	cbz	w0, 0x43b77c <.text+0x77c>
  43b6fc: 94001478     	bl	0x4408dc <.text+0x58dc>
  43b700: 14000021     	b	0x43b784 <.text+0x784>
  43b704: 94001328     	bl	0x4403a4 <.text+0x53a4>
  43b708: 34000220     	cbz	w0, 0x43b74c <.text+0x74c>
  43b70c: d0ffe521     	adrp	x1, 0xe1000
  43b710: aa1503e0     	mov	x0, x21
  43b714: 9400132c     	bl	0x4403c4 <.text+0x53c4>
  43b718: 340001a0     	cbz	w0, 0x43b74c <.text+0x74c>
  43b71c: d0ffe521     	adrp	x1, 0xe1000
  43b720: aa1603e0     	mov	x0, x22
  43b724: 94001328     	bl	0x4403c4 <.text+0x53c4>
  43b728: 34000120     	cbz	w0, 0x43b74c <.text+0x74c>
  43b72c: 940013ad     	bl	0x4405e0 <.text+0x55e0>
  43b730: 940013a0     	bl	0x4405b0 <.text+0x55b0>
  43b734: aa0003f5     	mov	x21, x0
  43b738: 94001460     	bl	0x4408b8 <.text+0x58b8>
  43b73c: 9400140a     	bl	0x440764 <.text+0x5764>
  43b740: 94a40e68     	bl	0x2d3f0e0 <.text+0x29040e0>
  43b744: 94001397     	bl	0x4405a0 <.text+0x55a0>
  43b748: 1400000b     	b	0x43b774 <.text+0x774>
  43b74c: 94001316     	bl	0x4403a4 <.text+0x53a4>
  43b750: 34000380     	cbz	w0, 0x43b7c0 <.text+0x7c0>
  43b754: d0ffe521     	adrp	x1, 0xe1000
  43b758: aa1503e0     	mov	x0, x21
  43b75c: 9400131a     	bl	0x4403c4 <.text+0x53c4>
  43b760: 34000300     	cbz	w0, 0x43b7c0 <.text+0x7c0>
  43b764: 9400139f     	bl	0x4405e0 <.text+0x55e0>
  43b768: 94001392     	bl	0x4405b0 <.text+0x55b0>
  43b76c: 94001455     	bl	0x4408c0 <.text+0x58c0>
  43b770: 94a40e5c     	bl	0x2d3f0e0 <.text+0x29040e0>
  43b774: 9400138d     	bl	0x4405a8 <.text+0x55a8>
  43b778: 14000017     	b	0x43b7d4 <.text+0x7d4>
  43b77c: aa1303e0     	mov	x0, x19
  43b780: 94a44617     	bl	0x2d4cfdc <.text+0x2911fdc>
  43b784: aa0003f3     	mov	x19, x0
  43b788: 9400137e     	bl	0x440580 <.text+0x5580>
  43b78c: 9400142d     	bl	0x440840 <.text+0x5840>
  43b790: d0015c48     	adrp	x8, 0x2fc5000
  43b794: b89fc3a2     	ldursw	x2, [x29, #-0x4]
  43b798: 94001427     	bl	0x440834 <.text+0x5834>
  43b79c: 9104c114     	add	x20, x8, #0x130
  43b7a0: aa1403e3     	mov	x3, x20
  43b7a4: 94ac721b     	bl	0x2f58010 <fwrite@plt>
  43b7a8: aa1403e0     	mov	x0, x20
  43b7ac: 94ac721d     	bl	0x2f58020 <fflush@plt>
  43b7b0: 94001451     	bl	0x4408f4 <.text+0x58f4>
  43b7b4: 94001308     	bl	0x4403d4 <.text+0x53d4>
  43b7b8: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b7bc: 14001380     	b	0x4405bc <.text+0x55bc>
  43b7c0: 940012f9     	bl	0x4403a4 <.text+0x53a4>
  43b7c4: 34000120     	cbz	w0, 0x43b7e8 <.text+0x7e8>
  43b7c8: 94001386     	bl	0x4405e0 <.text+0x55e0>
  43b7cc: 940013f2     	bl	0x440794 <.text+0x5794>
  43b7d0: 94a40e44     	bl	0x2d3f0e0 <.text+0x29040e0>
  43b7d4: aa1403e0     	mov	x0, x20
  43b7d8: 940012ff     	bl	0x4403d4 <.text+0x53d4>
  43b7dc: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b7e0: 910103ff     	add	sp, sp, #0x40
  43b7e4: 14a407b0     	b	0x2d3d6a4 <.text+0x29026a4>
  43b7e8: aa1303e0     	mov	x0, x19
  43b7ec: 97fffec1     	bl	0x43b2f0 <.text+0x2f0>
  43b7f0: 94001445     	bl	0x440904 <.text+0x5904>
  43b7f4: 94a40e3b     	bl	0x2d3f0e0 <.text+0x29040e0>
  43b7f8: aa1303e0     	mov	x0, x19
  43b7fc: 17fffff7     	b	0x43b7d8 <.text+0x7d8>
  43b800: 94001421     	bl	0x440884 <.text+0x5884>
  43b804: d0ffe362     	adrp	x2, 0xa9000
  43b808: 94001416     	bl	0x440860 <.text+0x5860>
  43b80c: 9114d442     	add	x2, x2, #0x535
  43b810: 1400000f     	b	0x43b84c <.text+0x84c>
  43b814: 9400141c     	bl	0x440884 <.text+0x5884>
  43b818: 90ffe342     	adrp	x2, 0xa3000
  43b81c: 94001411     	bl	0x440860 <.text+0x5860>
  43b820: 91310442     	add	x2, x2, #0xc41
  43b824: 1400000a     	b	0x43b84c <.text+0x84c>
  43b828: 94001417     	bl	0x440884 <.text+0x5884>
  43b82c: d0ffe562     	adrp	x2, 0xe9000
  43b830: 9400140c     	bl	0x440860 <.text+0x5860>
  43b834: 9100c042     	add	x2, x2, #0x30
  43b838: 14000005     	b	0x43b84c <.text+0x84c>
  43b83c: 94001412     	bl	0x440884 <.text+0x5884>
  43b840: 90ffe582     	adrp	x2, 0xeb000
  43b844: 94001407     	bl	0x440860 <.text+0x5860>
  43b848: 91357c42     	add	x2, x2, #0xd5f
  43b84c: 940012e2     	bl	0x4403d4 <.text+0x53d4>
  43b850: a9417bfd     	ldp	x29, x30, [sp, #0x10]
  43b854: 140013f6     	b	0x44082c <.text+0x582c>
  43b858: a9bb7bfd     	stp	x29, x30, [sp, #-0x50]!
  43b85c: a90167fa     	stp	x26, x25, [sp, #0x10]
  43b860: 910003fd     	mov	x29, sp
  43b864: a9025ff8     	stp	x24, x23, [sp, #0x20]
  43b868: a90357f6     	stp	x22, x21, [sp, #0x30]
  43b86c: a9044ff4     	stp	x20, x19, [sp, #0x40]
  43b870: aa0003fa     	mov	x26, x0
  43b874: 52808000     	mov	w0, #0x400              // =1024
  43b878: aa0403f3     	mov	x19, x4
  43b87c: 2a0303f4     	mov	w20, w3
  43b880: aa0203f6     	mov	x22, x2
  43b884: 2a0103f9     	mov	w25, w1
  43b888: 94a40776     	bl	0x2d3d660 <.text+0x2902660>
  43b88c: aa0003f5     	mov	x21, x0
  43b890: 9400133c     	bl	0x440580 <.text+0x5580>
  43b894: 52808000     	mov	w0, #0x400              // =1024
  43b898: 94a40772     	bl	0x2d3d660 <.text+0x2902660>
  43b89c: aa0003f7     	mov	x23, x0
  43b8a0: 94001338     	bl	0x440580 <.text+0x5580>
  43b8a4: 93407e80     	sxtw	x0, w20
  43b8a8: 94a4076e     	bl	0x2d3d660 <.text+0x2902660>
  43b8ac: aa0003f8     	mov	x24, x0
  43b8b0: 94001334     	bl	0x440580 <.text+0x5580>
  43b8b4: aa1f03e8     	mov	x8, xzr
  43b8b8: f104011f     	cmp	x8, #0x100
  43b8bc: 54000100     	b.eq	0x43b8dc <.text+0x8dc>
  43b8c0: 1ad90d09     	sdiv	w9, w8, w25
  43b8c4: b8287ae8     	str	w8, [x23, x8, lsl #2]
  43b8c8: 1b19a129     	msub	w9, w9, w25, w8
  43b8cc: 38694b49     	ldrb	w9, [x26, w9, uxtw]
  43b8d0: b8287aa9     	str	w9, [x21, x8, lsl #2]
  43b8d4: 91000508     	add	x8, x8, #0x1
  43b8d8: 17fffff8     	b	0x43b8b8 <.text+0x8b8>
  43b8dc: aa1f03e8     	mov	x8, xzr
  43b8e0: 2a1f03e9     	mov	w9, wzr
  43b8e4: 5280200a     	mov	w10, #0x100             // =256
  43b8e8: 7103fd1f     	cmp	w8, #0xff
  43b8ec: 54000188     	b.hi	0x43b91c <.text+0x91c>
  43b8f0: b8687aeb     	ldr	w11, [x23, x8, lsl #2]
  43b8f4: b8687aac     	ldr	w12, [x21, x8, lsl #2]
  43b8f8: 0b090169     	add	w9, w11, w9
  43b8fc: 0b0c0129     	add	w9, w9, w12
  43b900: 1aca0d2c     	sdiv	w12, w9, w10
  43b904: 4b0c2129     	sub	w9, w9, w12, lsl #8
  43b908: b869daec     	ldr	w12, [x23, w9, sxtw #2]
  43b90c: b8287aec     	str	w12, [x23, x8, lsl #2]
  43b910: 91000508     	add	x8, x8, #0x1
  43b914: b829daeb     	str	w11, [x23, w9, sxtw #2]
  43b918: 17fffff4     	b	0x43b8e8 <.text+0x8e8>
  43b91c: 7100029f     	cmp	w20, #0x0
  43b920: aa1f03e8     	mov	x8, xzr
  43b924: 2a1f03e9     	mov	w9, wzr
  43b928: 2a1f03eb     	mov	w11, wzr
  43b92c: 1a9fc28a     	csel	w10, w20, wzr, gt
  43b930: 5280200c     	mov	w12, #0x100             // =256
  43b934: eb08015f     	cmp	x10, x8
  43b938: 540002a0     	b.eq	0x43b98c <.text+0x98c>
  43b93c: 1100056b     	add	w11, w11, #0x1
  43b940: 1acc0d6d     	sdiv	w13, w11, w12
  43b944: 4b0d216b     	sub	w11, w11, w13, lsl #8
  43b948: b86bdaed     	ldr	w13, [x23, w11, sxtw #2]
  43b94c: 0b0901a9     	add	w9, w13, w9
  43b950: 1acc0d2e     	sdiv	w14, w9, w12
  43b954: 4b0e2129     	sub	w9, w9, w14, lsl #8
  43b958: b869daee     	ldr	w14, [x23, w9, sxtw #2]
  43b95c: b82bdaee     	str	w14, [x23, w11, sxtw #2]
  43b960: b829daed     	str	w13, [x23, w9, sxtw #2]
  43b964: b86bdaee     	ldr	w14, [x23, w11, sxtw #2]
  43b968: 0b0d01cd     	add	w13, w14, w13
  43b96c: 1acc0dae     	sdiv	w14, w13, w12
  43b970: 4b0e21ad     	sub	w13, w13, w14, lsl #8
  43b974: 38686ace     	ldrb	w14, [x22, x8]
  43b978: b86ddaed     	ldr	w13, [x23, w13, sxtw #2]
  43b97c: 4a0d01cd     	eor	w13, w14, w13
  43b980: 38286b0d     	strb	w13, [x24, x8]
  43b984: 91000508     	add	x8, x8, #0x1
  43b988: 17ffffeb     	b	0x43b934 <.text+0x934>
  43b98c: b4000053     	cbz	x19, 0x43b994 <.text+0x994>
  43b990: b9000274     	str	w20, [x19]
  43b994: 9400136a     	bl	0x44073c <.text+0x573c>
  43b998: 94001304     	bl	0x4405a8 <.text+0x55a8>
  43b99c: aa1803e0     	mov	x0, x24
  43b9a0: 940013bc     	bl	0x440890 <.text+0x5890>
  43b9a4: a8c57bfd     	ldp	x29, x30, [sp], #0x50
  43b9a8: d65f03c0     	ret
