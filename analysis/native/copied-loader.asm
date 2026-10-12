
com.pokemod.app.public/files/injector/pokemod-injector-arm64:	file format elf64-littleaarch64

Disassembly of section .text:

000000000043b000 <.text>:
  43e9ac: a9bd7bfd     	stp	x29, x30, [sp, #-0x30]!
  43e9b0: a90157f6     	stp	x22, x21, [sp, #0x10]
  43e9b4: 910003fd     	mov	x29, sp
  43e9b8: a9024ff4     	stp	x20, x19, [sp, #0x20]
  43e9bc: b9400008     	ldr	w8, [x0]
  43e9c0: 7100191f     	cmp	w8, #0x6
  43e9c4: 54005188     	b.hi	0x43f3f4 <.text+0x43f4>
  43e9c8: f0ffe2c9     	adrp	x9, 0x99000
  43e9cc: aa0003f3     	mov	x19, x0
  43e9d0: 9106b129     	add	x9, x9, #0x1ac
  43e9d4: 1000008a     	adr	x10, 0x43e9e4 <.text+0x39e4>
  43e9d8: 3868692b     	ldrb	w11, [x9, x8]
  43e9dc: 8b0b094a     	add	x10, x10, x11, lsl #2
  43e9e0: d61f0140     	br	x10
  43e9e4: f9401268     	ldr	x8, [x19, #0x20]
  43e9e8: f0ffe514     	adrp	x20, 0xe1000
  43e9ec: 910c2a94     	add	x20, x20, #0x30a
  43e9f0: 52800029     	mov	w9, #0x1                // =1
  43e9f4: aa1403e0     	mov	x0, x20
  43e9f8: f9400d08     	ldr	x8, [x8, #0x18]
  43e9fc: b9003d09     	str	w9, [x8, #0x3c]
  43ea00: 94a43977     	bl	0x2d4cfdc <.text+0x2911fdc>
  43ea04: a9028260     	stp	x0, x0, [x19, #0x28]
  43ea08: aa1403e0     	mov	x0, x20
  43ea0c: 94a43f0f     	bl	0x2d4e648 <.text+0x2913648>
  43ea10: a9038260     	stp	x0, x0, [x19, #0x38]
  43ea14: 94a14ed9     	bl	0x2c92578 <.text+0x2857578>
  43ea18: f9401269     	ldr	x9, [x19, #0x20]
  43ea1c: aa0003e8     	mov	x8, x0
  43ea20: f9400d29     	ldr	x9, [x9, #0x18]
  43ea24: a904a268     	stp	x8, x8, [x19, #0x48]
  43ea28: f9400d20     	ldr	x0, [x9, #0x18]
  43ea2c: f9002e60     	str	x0, [x19, #0x58]
  43ea30: b4001e40     	cbz	x0, 0x43edf8 <.text+0x3df8>
  43ea34: aa1303f5     	mov	x21, x19
  43ea38: aa1f03e2     	mov	x2, xzr
  43ea3c: f8070ebf     	str	xzr, [x21, #0x70]!
  43ea40: 910c22b4     	add	x20, x21, #0x308
  43ea44: aa1503e1     	mov	x1, x21
  43ea48: aa1403e3     	mov	x3, x20
  43ea4c: f81f82a0     	stur	x0, [x21, #-0x8]
  43ea50: 94a3c9ae     	bl	0x2d31108 <.text+0x28f6108>
  43ea54: f85f02a0     	ldur	x0, [x21, #-0x10]
  43ea58: 94a3fb13     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ea5c: f94002a1     	ldr	x1, [x21]
  43ea60: f94186a8     	ldr	x8, [x21, #0x308]
  43ea64: f81f02a1     	stur	x1, [x21, #-0x10]
  43ea68: b5003b88     	cbnz	x8, 0x43f1d8 <.text+0x41d8>
  43ea6c: f9401e60     	ldr	x0, [x19, #0x38]
  43ea70: a9078660     	stp	x0, x1, [x19, #0x78]
  43ea74: 94a43f32     	bl	0x2d4e73c <.text+0x291373c>
  43ea78: 90015c88     	adrp	x8, 0x2fce000
  43ea7c: b9414908     	ldr	w8, [x8, #0x148]
  43ea80: 34001d88     	cbz	w8, 0x43ee30 <.text+0x3e30>
  43ea84: b9008a7f     	str	wzr, [x19, #0x88]
  43ea88: 140000f0     	b	0x43ee48 <.text+0x3e48>
  43ea8c: f9417a60     	ldr	x0, [x19, #0x2f0]
  43ea90: 94000771     	bl	0x440854 <.text+0x5854>
  43ea94: 94001e32     	bl	0x44635c <.text+0xb35c>
  43ea98: f941be68     	ldr	x8, [x19, #0x378]
  43ea9c: f9018a60     	str	x0, [x19, #0x310]
  43eaa0: f9017660     	str	x0, [x19, #0x2e8]
  43eaa4: b5001788     	cbnz	x8, 0x43ed94 <.text+0x3d94>
  43eaa8: f9401268     	ldr	x8, [x19, #0x20]
  43eaac: f9400d09     	ldr	x9, [x8, #0x18]
  43eab0: f9400928     	ldr	x8, [x9, #0x10]
  43eab4: f9018e68     	str	x8, [x19, #0x318]
  43eab8: b4000368     	cbz	x8, 0x43eb24 <.text+0x3b24>
  43eabc: f9402d21     	ldr	x1, [x9, #0x58]
  43eac0: 52800049     	mov	w9, #0x2                // =2
  43eac4: aa1303e3     	mov	x3, x19
  43eac8: f9019268     	str	x8, [x19, #0x320]
  43eacc: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43ead0: f9019661     	str	x1, [x19, #0x328]
  43ead4: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ead8: b9000269     	str	w9, [x19]
  43eadc: 91109042     	add	x2, x2, #0x424
  43eae0: a9424ff4     	ldp	x20, x19, [sp, #0x20]
  43eae4: aa0803e0     	mov	x0, x8
  43eae8: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43eaec: 1400218a     	b	0x447114 <.text+0xc114>
  43eaf0: f9419260     	ldr	x0, [x19, #0x320]
  43eaf4: 94000758     	bl	0x440854 <.text+0x5854>
  43eaf8: 940021f7     	bl	0x4472d4 <.text+0xc2d4>
  43eafc: f941be68     	ldr	x8, [x19, #0x378]
  43eb00: b5001428     	cbnz	x8, 0x43ed84 <.text+0x3d84>
  43eb04: 9400065f     	bl	0x440480 <.text+0x5480>
  43eb08: f9400900     	ldr	x0, [x8, #0x10]
  43eb0c: b4000080     	cbz	x0, 0x43eb1c <.text+0x3b1c>
  43eb10: 94a35b8e     	bl	0x2d15948 <.text+0x28da948>
  43eb14: 9400065b     	bl	0x440480 <.text+0x5480>
  43eb18: f900091f     	str	xzr, [x8, #0x10]
  43eb1c: f9417660     	ldr	x0, [x19, #0x2e8]
  43eb20: f900091f     	str	xzr, [x8, #0x10]
  43eb24: f9019a60     	str	x0, [x19, #0x330]
  43eb28: 97fff716     	bl	0x43c780 <.text+0x1780>
  43eb2c: f9401263     	ldr	x3, [x19, #0x20]
  43eb30: f9019e60     	str	x0, [x19, #0x338]
  43eb34: f9400c69     	ldr	x9, [x3, #0x18]
  43eb38: f9400928     	ldr	x8, [x9, #0x10]
  43eb3c: b40000c8     	cbz	x8, 0x43eb54 <.text+0x3b54>
  43eb40: 9400062e     	bl	0x4403f8 <.text+0x53f8>
  43eb44: f9401263     	ldr	x3, [x19, #0x20]
  43eb48: f9419e60     	ldr	x0, [x19, #0x338]
  43eb4c: f9400c69     	ldr	x9, [x3, #0x18]
  43eb50: f900093f     	str	xzr, [x9, #0x10]
  43eb54: f0ffe341     	adrp	x1, 0xa9000
  43eb58: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43eb5c: 9115b821     	add	x1, x1, #0x56e
  43eb60: 9110d042     	add	x2, x2, #0x434
  43eb64: 2a1f03e4     	mov	w4, wzr
  43eb68: f9000920     	str	x0, [x9, #0x10]
  43eb6c: f901a260     	str	x0, [x19, #0x340]
  43eb70: 94a35fd9     	bl	0x2d16ad4 <.text+0x28dbad4>
  43eb74: f9401268     	ldr	x8, [x19, #0x20]
  43eb78: aa1303e3     	mov	x3, x19
  43eb7c: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43eb80: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43eb84: f9400d08     	ldr	x8, [x8, #0x18]
  43eb88: 91109042     	add	x2, x2, #0x424
  43eb8c: f9400900     	ldr	x0, [x8, #0x10]
  43eb90: f9402d01     	ldr	x1, [x8, #0x58]
  43eb94: 52800068     	mov	w8, #0x3                // =3
  43eb98: f901a660     	str	x0, [x19, #0x348]
  43eb9c: f901aa61     	str	x1, [x19, #0x350]
  43eba0: 9400068d     	bl	0x4405d4 <.text+0x55d4>
  43eba4: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43eba8: 140020e3     	b	0x446f34 <.text+0xbf34>
  43ebac: f941a660     	ldr	x0, [x19, #0x348]
  43ebb0: 94000729     	bl	0x440854 <.text+0x5854>
  43ebb4: 94002157     	bl	0x447110 <.text+0xc110>
  43ebb8: f941be68     	ldr	x8, [x19, #0x378]
  43ebbc: b5000e48     	cbnz	x8, 0x43ed84 <.text+0x3d84>
  43ebc0: 52800088     	mov	w8, #0x4                // =4
  43ebc4: f9401274     	ldr	x20, [x19, #0x20]
  43ebc8: b9000268     	str	w8, [x19]
  43ebcc: b4002f34     	cbz	x20, 0x43f1b0 <.text+0x41b0>
  43ebd0: 52801600     	mov	w0, #0xb0               // =176
  43ebd4: 94a430d9     	bl	0x2d4af38 <.text+0x290ff38>
  43ebd8: 2a1f03e1     	mov	w1, wzr
  43ebdc: 52801602     	mov	w2, #0xb0               // =176
  43ebe0: aa0003f5     	mov	x21, x0
  43ebe4: 94ac6527     	bl	0x2f58080 <memset@plt>
  43ebe8: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ebec: aa1403e0     	mov	x0, x20
  43ebf0: 91109042     	add	x2, x2, #0x424
  43ebf4: aa1f03e1     	mov	x1, xzr
  43ebf8: aa1303e3     	mov	x3, x19
  43ebfc: 94a1e7f4     	bl	0x2cb8bcc <.text+0x287dbcc>
  43ec00: 90ffe541     	adrp	x1, 0xe6000
  43ec04: aa0003f3     	mov	x19, x0
  43ec08: 911bd421     	add	x1, x1, #0x6f5
  43ec0c: f9000ea0     	str	x0, [x21, #0x18]
  43ec10: 94a1e8d0     	bl	0x2cb8f50 <.text+0x287df50>
  43ec14: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ec18: aa1303e0     	mov	x0, x19
  43ec1c: 91298042     	add	x2, x2, #0xa60
  43ec20: aa1503e1     	mov	x1, x21
  43ec24: 94a1e869     	bl	0x2cb8dc8 <.text+0x287ddc8>
  43ec28: aa1403e0     	mov	x0, x20
  43ec2c: 94a35b35     	bl	0x2d15900 <.text+0x28da900>
  43ec30: aa0003e8     	mov	x8, x0
  43ec34: aa1503e0     	mov	x0, x21
  43ec38: a9424ff4     	ldp	x20, x19, [sp, #0x20]
  43ec3c: f90012a8     	str	x8, [x21, #0x20]
  43ec40: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43ec44: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43ec48: 14000391     	b	0x43fa8c <.text+0x4a8c>
  43ec4c: f9400a60     	ldr	x0, [x19, #0x10]
  43ec50: aa1f03e1     	mov	x1, xzr
  43ec54: 94a1e9b7     	bl	0x2cb9330 <.text+0x287e330>
  43ec58: 528000a8     	mov	w8, #0x5                // =5
  43ec5c: f9401275     	ldr	x21, [x19, #0x20]
  43ec60: b9000268     	str	w8, [x19]
  43ec64: b40029d5     	cbz	x21, 0x43f19c <.text+0x419c>
  43ec68: 52800600     	mov	w0, #0x30               // =48
  43ec6c: 94a430b3     	bl	0x2d4af38 <.text+0x290ff38>
  43ec70: 6f00e400     	movi	v0.2d, #0000000000000000
  43ec74: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ec78: aa0003f4     	mov	x20, x0
  43ec7c: 91109042     	add	x2, x2, #0x424
  43ec80: aa1f03e1     	mov	x1, xzr
  43ec84: aa1303e3     	mov	x3, x19
  43ec88: ad000000     	stp	q0, q0, [x0]
  43ec8c: 3d800800     	str	q0, [x0, #0x20]
  43ec90: aa1503e0     	mov	x0, x21
  43ec94: 94a1e7ce     	bl	0x2cb8bcc <.text+0x287dbcc>
  43ec98: b0ffe2e1     	adrp	x1, 0x9b000
  43ec9c: aa0003f3     	mov	x19, x0
  43eca0: 91361421     	add	x1, x1, #0xd85
  43eca4: 9400069b     	bl	0x440710 <.text+0x5710>
  43eca8: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ecac: aa1303e0     	mov	x0, x19
  43ecb0: 91315042     	add	x2, x2, #0xc54
  43ecb4: 940006b2     	bl	0x44077c <.text+0x577c>
  43ecb8: aa1503e0     	mov	x0, x21
  43ecbc: 94a35b11     	bl	0x2d15900 <.text+0x28da900>
  43ecc0: b9400288     	ldr	w8, [x20]
  43ecc4: f9001280     	str	x0, [x20, #0x20]
  43ecc8: 35003a28     	cbnz	w8, 0x43f40c <.text+0x440c>
  43eccc: f9400e80     	ldr	x0, [x20, #0x18]
  43ecd0: aa1403e1     	mov	x1, x20
  43ecd4: aa1f03e2     	mov	x2, xzr
  43ecd8: b9002a9f     	str	wzr, [x20, #0x28]
  43ecdc: 94a1e991     	bl	0x2cb9320 <.text+0x287e320>
  43ece0: b9400288     	ldr	w8, [x20]
  43ece4: 34000868     	cbz	w8, 0x43edf0 <.text+0x3df0>
  43ece8: f9400e80     	ldr	x0, [x20, #0x18]
  43ecec: 94a1ea22     	bl	0x2cb9574 <.text+0x287e574>
  43ecf0: 35000800     	cbnz	w0, 0x43edf0 <.text+0x3df0>
  43ecf4: f9400e80     	ldr	x0, [x20, #0x18]
  43ecf8: 94a1e8ad     	bl	0x2cb8fac <.text+0x287dfac>
  43ecfc: 940005df     	bl	0x440478 <.text+0x5478>
  43ed00: 17fffffa     	b	0x43ece8 <.text+0x3ce8>
  43ed04: f9400a60     	ldr	x0, [x19, #0x10]
  43ed08: aa1f03e1     	mov	x1, xzr
  43ed0c: f9401274     	ldr	x20, [x19, #0x20]
  43ed10: 94a1e988     	bl	0x2cb9330 <.text+0x287e330>
  43ed14: b9402801     	ldr	w1, [x0, #0x28]
  43ed18: aa1403e0     	mov	x0, x20
  43ed1c: 9400033f     	bl	0x43fa18 <.text+0x4a18>
  43ed20: f9401268     	ldr	x8, [x19, #0x20]
  43ed24: f941be6a     	ldr	x10, [x19, #0x378]
  43ed28: f9400d08     	ldr	x8, [x8, #0x18]
  43ed2c: b9400109     	ldr	w9, [x8]
  43ed30: b9035a69     	str	w9, [x19, #0x358]
  43ed34: b500028a     	cbnz	x10, 0x43ed84 <.text+0x3d84>
  43ed38: 90015c89     	adrp	x9, 0x2fce000
  43ed3c: b9413929     	ldr	w9, [x9, #0x138]
  43ed40: 34000229     	cbz	w9, 0x43ed84 <.text+0x3d84>
  43ed44: f9400900     	ldr	x0, [x8, #0x10]
  43ed48: aa1303e3     	mov	x3, x19
  43ed4c: f9402d01     	ldr	x1, [x8, #0x58]
  43ed50: 528000c8     	mov	w8, #0x6                // =6
  43ed54: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43ed58: f901b260     	str	x0, [x19, #0x360]
  43ed5c: b0000002     	adrp	x2, 0x43f000 <.text+0x4000>
  43ed60: f901b661     	str	x1, [x19, #0x368]
  43ed64: 91109042     	add	x2, x2, #0x424
  43ed68: 9400061b     	bl	0x4405d4 <.text+0x55d4>
  43ed6c: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43ed70: 1400215a     	b	0x4472d8 <.text+0xc2d8>
  43ed74: f941b260     	ldr	x0, [x19, #0x360]
  43ed78: 940006b7     	bl	0x440854 <.text+0x5854>
  43ed7c: 940021e2     	bl	0x447504 <.text+0xc504>
  43ed80: f941be68     	ldr	x8, [x19, #0x378]
  43ed84: f9417660     	ldr	x0, [x19, #0x2e8]
  43ed88: b4000060     	cbz	x0, 0x43ed94 <.text+0x3d94>
  43ed8c: 94a35aef     	bl	0x2d15948 <.text+0x28da948>
  43ed90: f901767f     	str	xzr, [x19, #0x2e8]
  43ed94: f9402660     	ldr	x0, [x19, #0x48]
  43ed98: b4000060     	cbz	x0, 0x43eda4 <.text+0x3da4>
  43ed9c: 94a35aeb     	bl	0x2d15948 <.text+0x28da948>
  43eda0: f900267f     	str	xzr, [x19, #0x48]
  43eda4: f9401e60     	ldr	x0, [x19, #0x38]
  43eda8: b4000060     	cbz	x0, 0x43edb4 <.text+0x3db4>
  43edac: 94000642     	bl	0x4406b4 <.text+0x56b4>
  43edb0: f9001e7f     	str	xzr, [x19, #0x38]
  43edb4: 94000621     	bl	0x440638 <.text+0x5638>
  43edb8: f9401268     	ldr	x8, [x19, #0x20]
  43edbc: f900167f     	str	xzr, [x19, #0x28]
  43edc0: f9400d09     	ldr	x9, [x8, #0x18]
  43edc4: f941be68     	ldr	x8, [x19, #0x378]
  43edc8: b9003d3f     	str	wzr, [x9, #0x3c]
  43edcc: b5001ce8     	cbnz	x8, 0x43f168 <.text+0x4168>
  43edd0: 94000579     	bl	0x4403b4 <.text+0x53b4>
  43edd4: b9400268     	ldr	w8, [x19]
  43edd8: 34002c48     	cbz	w8, 0x43f360 <.text+0x4360>
  43eddc: 940005b6     	bl	0x4404b4 <.text+0x54b4>
  43ede0: 35002c00     	cbnz	w0, 0x43f360 <.text+0x4360>
  43ede4: 940005b6     	bl	0x4404bc <.text+0x54bc>
  43ede8: 940005a4     	bl	0x440478 <.text+0x5478>
  43edec: 17fffffc     	b	0x43eddc <.text+0x3ddc>
  43edf0: f9400e80     	ldr	x0, [x20, #0x18]
  43edf4: 1400015c     	b	0x43f364 <.text+0x4364>
  43edf8: f9401120     	ldr	x0, [x9, #0x20]
  43edfc: f9016660     	str	x0, [x19, #0x2c8]
  43ee00: 94a43877     	bl	0x2d4cfdc <.text+0x2911fdc>
  43ee04: f9401668     	ldr	x8, [x19, #0x28]
  43ee08: f9016a60     	str	x0, [x19, #0x2d0]
  43ee0c: 940005f0     	bl	0x4405cc <.text+0x55cc>
  43ee10: b0ffe2e1     	adrp	x1, 0x9b000
  43ee14: f9416a68     	ldr	x8, [x19, #0x2d0]
  43ee18: f9402660     	ldr	x0, [x19, #0x48]
  43ee1c: 91360021     	add	x1, x1, #0xd80
  43ee20: f9001668     	str	x8, [x19, #0x28]
  43ee24: f9016e60     	str	x0, [x19, #0x2d8]
  43ee28: 94a14dd9     	bl	0x2c9258c <.text+0x285758c>
  43ee2c: 1400008c     	b	0x43f05c <.text+0x405c>
  43ee30: b0015c48     	adrp	x8, 0x2fc7000
  43ee34: b94dad08     	ldr	w8, [x8, #0xdac]
  43ee38: 7100011f     	cmp	w8, #0x0
  43ee3c: 1a9f17e9     	cset	w9, eq
  43ee40: b9008a69     	str	w9, [x19, #0x88]
  43ee44: 340013a8     	cbz	w8, 0x43f0b8 <.text+0x40b8>
  43ee48: aa1303f5     	mov	x21, x19
  43ee4c: f80a0ebf     	str	xzr, [x21, #0xa0]!
  43ee50: f85c02a0     	ldur	x0, [x21, #-0x40]
  43ee54: aa1503e1     	mov	x1, x21
  43ee58: f81f82a0     	stur	x0, [x21, #-0x8]
  43ee5c: 94a39fde     	bl	0x2d26dd4 <.text+0x28ebdd4>
  43ee60: b94002a8     	ldr	w8, [x21]
  43ee64: f90006a0     	str	x0, [x21, #0x8]
  43ee68: f81f02a0     	stur	x0, [x21, #-0x10]
  43ee6c: 290222a8     	stp	w8, w8, [x21, #0x10]
  43ee70: 97fff086     	bl	0x43b088 <.text+0x88>
  43ee74: a90202a0     	stp	x0, x0, [x21, #0x20]
  43ee78: 97fff09c     	bl	0x43b0e8 <.text+0xe8>
  43ee7c: aa0003e1     	mov	x1, x0
  43ee80: f94016a0     	ldr	x0, [x21, #0x28]
  43ee84: aa1f03e2     	mov	x2, xzr
  43ee88: a90306a1     	stp	x1, x1, [x21, #0x30]
  43ee8c: 94a438c6     	bl	0x2d4d1a4 <.text+0x29121a4>
  43ee90: a90402a0     	stp	x0, x0, [x21, #0x40]
  43ee94: 97fff0f6     	bl	0x43b26c <.text+0x26c>
  43ee98: aa0003e1     	mov	x1, x0
  43ee9c: f94026a0     	ldr	x0, [x21, #0x48]
  43eea0: aa1f03e2     	mov	x2, xzr
  43eea4: a90506a1     	stp	x1, x1, [x21, #0x50]
  43eea8: 94a438bf     	bl	0x2d4d1a4 <.text+0x29121a4>
  43eeac: 9101f2a1     	add	x1, x21, #0x7c
  43eeb0: a90602a0     	stp	x0, x0, [x21, #0x60]
  43eeb4: b9007ebf     	str	wzr, [x21, #0x7c]
  43eeb8: 97fff1d5     	bl	0x43b60c <.text+0x60c>
  43eebc: b9407ea1     	ldr	w1, [x21, #0x7c]
  43eec0: 910272a4     	add	x4, x21, #0x9c
  43eec4: f85f02a2     	ldur	x2, [x21, #-0x10]
  43eec8: f9003aa0     	str	x0, [x21, #0x70]
  43eecc: b94012a3     	ldr	w3, [x21, #0x10]
  43eed0: f90042a0     	str	x0, [x21, #0x80]
  43eed4: b9007aa1     	str	w1, [x21, #0x78]
  43eed8: b9008aa1     	str	w1, [x21, #0x88]
  43eedc: f9004aa2     	str	x2, [x21, #0x90]
  43eee0: 29137ea3     	stp	w3, wzr, [x21, #0x98]
  43eee4: 97fff25d     	bl	0x43b858 <.text+0x858>
  43eee8: f94036a8     	ldr	x8, [x21, #0x68]
  43eeec: a90a02a0     	stp	x0, x0, [x21, #0xa0]
  43eef0: b9409ea9     	ldr	w9, [x21, #0x9c]
  43eef4: aa0803e0     	mov	x0, x8
  43eef8: b900b2a9     	str	w9, [x21, #0xb0]
  43eefc: 94a3f9ea     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ef00: f9402ea0     	ldr	x0, [x21, #0x58]
  43ef04: f90036bf     	str	xzr, [x21, #0x68]
  43ef08: 94a3f9e7     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ef0c: f94026a0     	ldr	x0, [x21, #0x48]
  43ef10: f9002ebf     	str	xzr, [x21, #0x58]
  43ef14: 94a3f9e4     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ef18: f9401ea0     	ldr	x0, [x21, #0x38]
  43ef1c: f90026bf     	str	xzr, [x21, #0x48]
  43ef20: 94a3f9e1     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ef24: f94016a0     	ldr	x0, [x21, #0x28]
  43ef28: f9001ebf     	str	xzr, [x21, #0x38]
  43ef2c: 94a3f9de     	bl	0x2d3d6a4 <.text+0x29026a4>
  43ef30: 90ffe442     	adrp	x2, 0xc6000
  43ef34: f94056a0     	ldr	x0, [x21, #0xa8]
  43ef38: 91307c42     	add	x2, x2, #0xc1f
  43ef3c: b980b2a1     	ldrsw	x1, [x21, #0xb0]
  43ef40: aa0203e3     	mov	x3, x2
  43ef44: aa1f03e4     	mov	x4, xzr
  43ef48: aa1f03e5     	mov	x5, xzr
  43ef4c: aa1403e6     	mov	x6, x20
  43ef50: f90016bf     	str	xzr, [x21, #0x28]
  43ef54: f9000ea0     	str	x0, [x21, #0x18]
  43ef58: 291686a1     	stp	w1, w1, [x21, #0xb4]
  43ef5c: f90066a0     	str	x0, [x21, #0xc8]
  43ef60: b900d2a1     	str	w1, [x21, #0xd0]
  43ef64: f9006ea0     	str	x0, [x21, #0xd8]
  43ef68: b900e2a1     	str	w1, [x21, #0xe0]
  43ef6c: 94a3b6a4     	bl	0x2d2c9fc <.text+0x28f19fc>
  43ef70: f9416ea8     	ldr	x8, [x21, #0x2d8]
  43ef74: f90076a0     	str	x0, [x21, #0xe8]
  43ef78: f90062a0     	str	x0, [x21, #0xc0]
  43ef7c: b5001548     	cbnz	x8, 0x43f224 <.text+0x4224>
  43ef80: f9401668     	ldr	x8, [x19, #0x28]
  43ef84: f900ca60     	str	x0, [x19, #0x190]
  43ef88: f900b27f     	str	xzr, [x19, #0x160]
  43ef8c: 94000590     	bl	0x4405cc <.text+0x55cc>
  43ef90: f940ca68     	ldr	x8, [x19, #0x190]
  43ef94: f940b260     	ldr	x0, [x19, #0x160]
  43ef98: f9001668     	str	x8, [x19, #0x28]
  43ef9c: 94a3f9c2     	bl	0x2d3d6a4 <.text+0x29026a4>
  43efa0: f900b27f     	str	xzr, [x19, #0x160]
  43efa4: f9405e60     	ldr	x0, [x19, #0xb8]
  43efa8: f941be75     	ldr	x21, [x19, #0x378]
  43efac: 94a3f9be     	bl	0x2d3d6a4 <.text+0x29026a4>
  43efb0: f9404a60     	ldr	x0, [x19, #0x90]
  43efb4: f9005e7f     	str	xzr, [x19, #0xb8]
  43efb8: 94a3f9bb     	bl	0x2d3d6a4 <.text+0x29026a4>
  43efbc: f9004a7f     	str	xzr, [x19, #0x90]
  43efc0: b50016b5     	cbnz	x21, 0x43f294 <.text+0x4294>
  43efc4: 94000657     	bl	0x440920 <.text+0x5920>
  43efc8: f900327f     	str	xzr, [x19, #0x60]
  43efcc: f9400288     	ldr	x8, [x20]
  43efd0: f9402660     	ldr	x0, [x19, #0x48]
  43efd4: b5ffee28     	cbnz	x8, 0x43ed98 <.text+0x3d98>
  43efd8: f9401268     	ldr	x8, [x19, #0x20]
  43efdc: f9014260     	str	x0, [x19, #0x280]
  43efe0: f9400d08     	ldr	x8, [x8, #0x18]
  43efe4: f9400d08     	ldr	x8, [x8, #0x18]
  43efe8: aa0803e0     	mov	x0, x8
  43efec: f9014668     	str	x8, [x19, #0x288]
  43eff0: 94a3cb9d     	bl	0x2d31e64 <.text+0x28f6e64>
  43eff4: 90ffe301     	adrp	x1, 0x9e000
  43eff8: 52800042     	mov	w2, #0x2                // =2
  43effc: 911ac821     	add	x1, x1, #0x6b2
  43f000: f9014a60     	str	x0, [x19, #0x290]
  43f004: f9014e60     	str	x0, [x19, #0x298]
  43f008: 94a43af5     	bl	0x2d4dbdc <.text+0x2912bdc>
  43f00c: aa0003f4     	mov	x20, x0
  43f010: f9015260     	str	x0, [x19, #0x2a0]
  43f014: f9015660     	str	x0, [x19, #0x2a8]
  43f018: f9015a60     	str	x0, [x19, #0x2b0]
  43f01c: 97fffaae     	bl	0x43dad4 <.text+0x2ad4>
  43f020: f9414268     	ldr	x8, [x19, #0x280]
  43f024: b902ba60     	str	w0, [x19, #0x2b8]
  43f028: f9400281     	ldr	x1, [x20]
  43f02c: aa0803e0     	mov	x0, x8
  43f030: f9016261     	str	x1, [x19, #0x2c0]
  43f034: 94a14d56     	bl	0x2c9258c <.text+0x285758c>
  43f038: d0015c22     	adrp	x2, 0x2fc5000
  43f03c: f9415a60     	ldr	x0, [x19, #0x2b0]
  43f040: b982ba61     	ldrsw	x1, [x19, #0x2b8]
  43f044: f9411842     	ldr	x2, [x2, #0x230]
  43f048: 97fff7d9     	bl	0x43cfac <.text+0x1fac>
  43f04c: f9414e60     	ldr	x0, [x19, #0x298]
  43f050: f9015a7f     	str	xzr, [x19, #0x2b0]
  43f054: 94a3f994     	bl	0x2d3d6a4 <.text+0x29026a4>
  43f058: f9014e7f     	str	xzr, [x19, #0x298]
  43f05c: f9401268     	ldr	x8, [x19, #0x20]
  43f060: f9402660     	ldr	x0, [x19, #0x48]
  43f064: f9400d08     	ldr	x8, [x8, #0x18]
  43f068: f9017260     	str	x0, [x19, #0x2e0]
  43f06c: b9402901     	ldr	w1, [x8, #0x28]
  43f070: 94a14d8e     	bl	0x2c926a8 <.text+0x28576a8>
  43f074: a9420668     	ldp	x8, x1, [x19, #0x20]
  43f078: aa1303e5     	mov	x5, x19
  43f07c: 90000004     	adrp	x4, 0x43f000 <.text+0x4000>
  43f080: f9402662     	ldr	x2, [x19, #0x48]
  43f084: 91109084     	add	x4, x4, #0x424
  43f088: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43f08c: f9400d08     	ldr	x8, [x8, #0x18]
  43f090: f9017e61     	str	x1, [x19, #0x2f8]
  43f094: f9018262     	str	x2, [x19, #0x300]
  43f098: f9400500     	ldr	x0, [x8, #0x8]
  43f09c: f9402d03     	ldr	x3, [x8, #0x58]
  43f0a0: 52800028     	mov	w8, #0x1                // =1
  43f0a4: f9017a60     	str	x0, [x19, #0x2f0]
  43f0a8: f9018663     	str	x3, [x19, #0x308]
  43f0ac: 9400054a     	bl	0x4405d4 <.text+0x55d4>
  43f0b0: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43f0b4: 14001bca     	b	0x445fdc <.text+0xafdc>
  43f0b8: f9401e68     	ldr	x8, [x19, #0x38]
  43f0bc: f0ffe422     	adrp	x2, 0xc6000
  43f0c0: 91307c42     	add	x2, x2, #0xc1f
  43f0c4: aa1f03e4     	mov	x4, xzr
  43f0c8: aa0203e3     	mov	x3, x2
  43f0cc: aa1f03e5     	mov	x5, xzr
  43f0d0: a9400500     	ldp	x0, x1, [x8]
  43f0d4: aa1403e6     	mov	x6, x20
  43f0d8: f900fa68     	str	x8, [x19, #0x1f0]
  43f0dc: a91e0268     	stp	x8, x0, [x19, #0x1e0]
  43f0e0: 94a3b647     	bl	0x2d2c9fc <.text+0x28f19fc>
  43f0e4: f941be68     	ldr	x8, [x19, #0x378]
  43f0e8: f900fe60     	str	x0, [x19, #0x1f8]
  43f0ec: f900ee60     	str	x0, [x19, #0x1d8]
  43f0f0: b5001428     	cbnz	x8, 0x43f374 <.text+0x4374>
  43f0f4: f9401668     	ldr	x8, [x19, #0x28]
  43f0f8: f9010260     	str	x0, [x19, #0x200]
  43f0fc: f900ee7f     	str	xzr, [x19, #0x1d8]
  43f100: 94000533     	bl	0x4405cc <.text+0x55cc>
  43f104: f9410268     	ldr	x8, [x19, #0x200]
  43f108: f940ee60     	ldr	x0, [x19, #0x1d8]
  43f10c: f9001668     	str	x8, [x19, #0x28]
  43f110: 94a3f965     	bl	0x2d3d6a4 <.text+0x29026a4>
  43f114: f900ee7f     	str	xzr, [x19, #0x1d8]
  43f118: f9400288     	ldr	x8, [x20]
  43f11c: b4fff548     	cbz	x8, 0x43efc4 <.text+0x3fc4>
  43f120: 94000600     	bl	0x440920 <.text+0x5920>
  43f124: 94000519     	bl	0x440588 <.text+0x5588>
  43f128: 6b0002bf     	cmp	w21, w0
  43f12c: 54000bc0     	b.eq	0x43f2a4 <.text+0x42a4>
  43f130: f9402660     	ldr	x0, [x19, #0x48]
  43f134: b4000060     	cbz	x0, 0x43f140 <.text+0x4140>
  43f138: 94a35a04     	bl	0x2d15948 <.text+0x28da948>
  43f13c: f900267f     	str	xzr, [x19, #0x48]
  43f140: f9401e60     	ldr	x0, [x19, #0x38]
  43f144: b4000060     	cbz	x0, 0x43f150 <.text+0x4150>
  43f148: 9400055b     	bl	0x4406b4 <.text+0x56b4>
  43f14c: f9001e7f     	str	xzr, [x19, #0x38]
  43f150: 9400053a     	bl	0x440638 <.text+0x5638>
  43f154: 940004ab     	bl	0x440400 <.text+0x5400>
  43f158: b94006c7     	ldr	w7, [x22, #0x4]
  43f15c: 9400047a     	bl	0x440344 <.text+0x5344>
  43f160: 52805724     	mov	w4, #0x2b9              // =697
  43f164: 1400007d     	b	0x43f358 <.text+0x4358>
  43f168: b9400114     	ldr	w20, [x8]
  43f16c: 94a140f5     	bl	0x2c8f540 <.text+0x2854540>
  43f170: 6b00029f     	cmp	w20, w0
  43f174: 540000c0     	b.eq	0x43f18c <.text+0x418c>
  43f178: 910de274     	add	x20, x19, #0x378
  43f17c: f9400288     	ldr	x8, [x20]
  43f180: 940004fe     	bl	0x440578 <.text+0x5578>
  43f184: 6b0002bf     	cmp	w21, w0
  43f188: 54000c41     	b.ne	0x43f310 <.text+0x4310>
  43f18c: f9400e60     	ldr	x0, [x19, #0x18]
  43f190: f941be61     	ldr	x1, [x19, #0x378]
  43f194: 94a1e6e4     	bl	0x2cb8d24 <.text+0x287dd24>
  43f198: 14000072     	b	0x43f360 <.text+0x4360>
  43f19c: d0ffe380     	adrp	x0, 0xb1000
  43f1a0: f0ffe361     	adrp	x1, 0xae000
  43f1a4: 911a5000     	add	x0, x0, #0x694
  43f1a8: 9130cc21     	add	x1, x1, #0xc33
  43f1ac: 14000005     	b	0x43f1c0 <.text+0x41c0>
  43f1b0: d0ffe380     	adrp	x0, 0xb1000
  43f1b4: f0ffe3e1     	adrp	x1, 0xbe000
  43f1b8: 911a5000     	add	x0, x0, #0x694
  43f1bc: 913cc421     	add	x1, x1, #0xf31
  43f1c0: a9424ff4     	ldp	x20, x19, [sp, #0x20]
  43f1c4: 90ffe3c2     	adrp	x2, 0xb7000
  43f1c8: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43f1cc: 91066842     	add	x2, x2, #0x19a
  43f1d0: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43f1d4: 14a3ff1e     	b	0x2d3ee4c <.text+0x2903e4c>
  43f1d8: aa0103e0     	mov	x0, x1
  43f1dc: 94a3f932     	bl	0x2d3d6a4 <.text+0x29026a4>
  43f1e0: 940004ea     	bl	0x440588 <.text+0x5588>
  43f1e4: 6b0002bf     	cmp	w21, w0
  43f1e8: 540005e0     	b.eq	0x43f2a4 <.text+0x42a4>
  43f1ec: f9402660     	ldr	x0, [x19, #0x48]
  43f1f0: b4000060     	cbz	x0, 0x43f1fc <.text+0x41fc>
  43f1f4: 94a359d5     	bl	0x2d15948 <.text+0x28da948>
  43f1f8: f900267f     	str	xzr, [x19, #0x48]
  43f1fc: f9401e60     	ldr	x0, [x19, #0x38]
  43f200: b4000060     	cbz	x0, 0x43f20c <.text+0x420c>
  43f204: 9400052c     	bl	0x4406b4 <.text+0x56b4>
  43f208: f9001e7f     	str	xzr, [x19, #0x38]
  43f20c: 9400050b     	bl	0x440638 <.text+0x5638>
  43f210: 9400047c     	bl	0x440400 <.text+0x5400>
  43f214: b94006c7     	ldr	w7, [x22, #0x4]
  43f218: 9400044b     	bl	0x440344 <.text+0x5344>
  43f21c: 528052e4     	mov	w4, #0x297              // =663
  43f220: 1400004e     	b	0x43f358 <.text+0x4358>
  43f224: b0ffe420     	adrp	x0, 0xc4000
  43f228: f9400501     	ldr	x1, [x8, #0x8]
  43f22c: 910d1000     	add	x0, x0, #0x344
  43f230: f901be7f     	str	xzr, [x19, #0x378]
  43f234: a919a268     	stp	x8, x8, [x19, #0x198]
  43f238: f900d661     	str	x1, [x19, #0x1a8]
  43f23c: 94a437bd     	bl	0x2d4d130 <.text+0x2912130>
  43f240: d0ffe501     	adrp	x1, 0xe1000
  43f244: a91b0260     	stp	x0, x0, [x19, #0x1b0]
  43f248: 910c2821     	add	x1, x1, #0x30a
  43f24c: 94000465     	bl	0x4403e0 <.text+0x53e0>
  43f250: f940de60     	ldr	x0, [x19, #0x1b8]
  43f254: 94a3f914     	bl	0x2d3d6a4 <.text+0x29026a4>
  43f258: f9401e68     	ldr	x8, [x19, #0x38]
  43f25c: f9400100     	ldr	x0, [x8]
  43f260: a91ba27f     	stp	xzr, x8, [x19, #0x1b8]
  43f264: f900e660     	str	x0, [x19, #0x1c8]
  43f268: 94a4375d     	bl	0x2d4cfdc <.text+0x2911fdc>
  43f26c: f9401668     	ldr	x8, [x19, #0x28]
  43f270: f900ea60     	str	x0, [x19, #0x1d0]
  43f274: 940004d6     	bl	0x4405cc <.text+0x55cc>
  43f278: f940ea68     	ldr	x8, [x19, #0x1d0]
  43f27c: f940ce60     	ldr	x0, [x19, #0x198]
  43f280: f9001668     	str	x8, [x19, #0x28]
  43f284: b4ffe900     	cbz	x0, 0x43efa4 <.text+0x3fa4>
  43f288: 94a3c5b2     	bl	0x2d30950 <.text+0x28f5950>
  43f28c: f900ce7f     	str	xzr, [x19, #0x198]
  43f290: 17ffff45     	b	0x43efa4 <.text+0x3fa4>
  43f294: 940005a3     	bl	0x440920 <.text+0x5920>
  43f298: 940004bc     	bl	0x440588 <.text+0x5588>
  43f29c: 6b0002bf     	cmp	w21, w0
  43f2a0: 54000421     	b.ne	0x43f324 <.text+0x4324>
  43f2a4: f941be68     	ldr	x8, [x19, #0x378]
  43f2a8: f901be7f     	str	xzr, [x19, #0x378]
  43f2ac: f9400500     	ldr	x0, [x8, #0x8]
  43f2b0: f9012668     	str	x8, [x19, #0x248]
  43f2b4: f9012a68     	str	x8, [x19, #0x250]
  43f2b8: f9012e60     	str	x0, [x19, #0x258]
  43f2bc: 97fff00d     	bl	0x43b2f0 <.text+0x2f0>
  43f2c0: f9013260     	str	x0, [x19, #0x260]
  43f2c4: f9013660     	str	x0, [x19, #0x268]
  43f2c8: 94a1409e     	bl	0x2c8f540 <.text+0x2854540>
  43f2cc: f0ffe322     	adrp	x2, 0xa6000
  43f2d0: f9413663     	ldr	x3, [x19, #0x268]
  43f2d4: 91340442     	add	x2, x2, #0xd01
  43f2d8: 528000a1     	mov	w1, #0x5                // =5
  43f2dc: 94a3c57a     	bl	0x2d308c4 <.text+0x28f58c4>
  43f2e0: f9413668     	ldr	x8, [x19, #0x268]
  43f2e4: f9013a60     	str	x0, [x19, #0x270]
  43f2e8: f9013e60     	str	x0, [x19, #0x278]
  43f2ec: 940004b8     	bl	0x4405cc <.text+0x55cc>
  43f2f0: f9413e68     	ldr	x8, [x19, #0x278]
  43f2f4: f901367f     	str	xzr, [x19, #0x268]
  43f2f8: f9412660     	ldr	x0, [x19, #0x248]
  43f2fc: f901be68     	str	x8, [x19, #0x378]
  43f300: b4ffe680     	cbz	x0, 0x43efd0 <.text+0x3fd0>
  43f304: 94a3c593     	bl	0x2d30950 <.text+0x28f5950>
  43f308: f901267f     	str	xzr, [x19, #0x248]
  43f30c: 17ffff30     	b	0x43efcc <.text+0x3fcc>
  43f310: f941be76     	ldr	x22, [x19, #0x378]
  43f314: 94000452     	bl	0x44045c <.text+0x545c>
  43f318: 94000414     	bl	0x440368 <.text+0x5368>
  43f31c: 528051e4     	mov	w4, #0x28f              // =655
  43f320: 1400000e     	b	0x43f358 <.text+0x4358>
  43f324: f9402660     	ldr	x0, [x19, #0x48]
  43f328: b4000060     	cbz	x0, 0x43f334 <.text+0x4334>
  43f32c: 94a35987     	bl	0x2d15948 <.text+0x28da948>
  43f330: f900267f     	str	xzr, [x19, #0x48]
  43f334: f9401e60     	ldr	x0, [x19, #0x38]
  43f338: b4000060     	cbz	x0, 0x43f344 <.text+0x4344>
  43f33c: 940004de     	bl	0x4406b4 <.text+0x56b4>
  43f340: f9001e7f     	str	xzr, [x19, #0x38]
  43f344: 940004bd     	bl	0x440638 <.text+0x5638>
  43f348: 9400042e     	bl	0x440400 <.text+0x5400>
  43f34c: b94006c7     	ldr	w7, [x22, #0x4]
  43f350: 940003fd     	bl	0x440344 <.text+0x5344>
  43f354: 52805424     	mov	w4, #0x2a1              // =673
  43f358: 940004ae     	bl	0x440610 <.text+0x5610>
  43f35c: 9400048f     	bl	0x440598 <.text+0x5598>
  43f360: f9400e60     	ldr	x0, [x19, #0x18]
  43f364: a9424ff4     	ldp	x20, x19, [sp, #0x20]
  43f368: a94157f6     	ldp	x22, x21, [sp, #0x10]
  43f36c: a8c37bfd     	ldp	x29, x30, [sp], #0x30
  43f370: 14a35976     	b	0x2d15948 <.text+0x28da948>
  43f374: f9401e69     	ldr	x9, [x19, #0x38]
  43f378: f9010668     	str	x8, [x19, #0x208]
  43f37c: f901be7f     	str	xzr, [x19, #0x378]
  43f380: f9400120     	ldr	x0, [x9]
  43f384: f9010a69     	str	x9, [x19, #0x210]
  43f388: f9010e60     	str	x0, [x19, #0x218]
  43f38c: 94a43714     	bl	0x2d4cfdc <.text+0x2911fdc>
  43f390: f9401668     	ldr	x8, [x19, #0x28]
  43f394: f9011260     	str	x0, [x19, #0x220]
  43f398: 9400048d     	bl	0x4405cc <.text+0x55cc>
  43f39c: f9410668     	ldr	x8, [x19, #0x208]
  43f3a0: f0ffe460     	adrp	x0, 0xce000
  43f3a4: f9411269     	ldr	x9, [x19, #0x220]
  43f3a8: 912d7400     	add	x0, x0, #0xb5d
  43f3ac: f9400501     	ldr	x1, [x8, #0x8]
  43f3b0: f9011668     	str	x8, [x19, #0x228]
  43f3b4: f9001669     	str	x9, [x19, #0x28]
  43f3b8: f9011a61     	str	x1, [x19, #0x230]
  43f3bc: 94a4375d     	bl	0x2d4d130 <.text+0x2912130>
  43f3c0: d0ffe501     	adrp	x1, 0xe1000
  43f3c4: f9011e60     	str	x0, [x19, #0x238]
  43f3c8: 910c2821     	add	x1, x1, #0x30a
  43f3cc: f9012260     	str	x0, [x19, #0x240]
  43f3d0: 94000404     	bl	0x4403e0 <.text+0x53e0>
  43f3d4: f9412260     	ldr	x0, [x19, #0x240]
  43f3d8: 94a3f8b3     	bl	0x2d3d6a4 <.text+0x29026a4>
  43f3dc: f9410660     	ldr	x0, [x19, #0x208]
  43f3e0: f901227f     	str	xzr, [x19, #0x240]
  43f3e4: b4ffe9a0     	cbz	x0, 0x43f118 <.text+0x4118>
  43f3e8: 94a3c55a     	bl	0x2d30950 <.text+0x28f5950>
  43f3ec: f901067f     	str	xzr, [x19, #0x208]
  43f3f0: 17ffff4a     	b	0x43f118 <.text+0x4118>
  43f3f4: 9400044e     	bl	0x44052c <.text+0x552c>
  43f3f8: 90ffe323     	adrp	x3, 0xa3000
  43f3fc: 94000449     	bl	0x440520 <.text+0x5520>
  43f400: 9132e863     	add	x3, x3, #0xcba
  43f404: 528051a2     	mov	w2, #0x28d              // =653
  43f408: 14000006     	b	0x43f420 <.text+0x4420>
  43f40c: 94000448     	bl	0x44052c <.text+0x552c>
  43f410: d0ffe443     	adrp	x3, 0xc9000
  43f414: 94000443     	bl	0x440520 <.text+0x5520>
  43f418: 91129863     	add	x3, x3, #0x4a6
  43f41c: 528060a2     	mov	w2, #0x305              // =773
  43f420: 9400043c     	bl	0x440510 <.text+0x5510>
