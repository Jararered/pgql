
com.pokemod.app.public/files/injector/pokemod-injector-arm64:	file format elf64-littleaarch64

Disassembly of section .text:

000000000043b000 <.text>:
  43b9ac: d101c3ff     	sub	sp, sp, #0x70
  43b9b0: a9027bfd     	stp	x29, x30, [sp, #0x20]
  43b9b4: 910083fd     	add	x29, sp, #0x20
  43b9b8: f9001bf9     	str	x25, [sp, #0x30]
  43b9bc: a9045ff8     	stp	x24, x23, [sp, #0x40]
  43b9c0: a90557f6     	stp	x22, x21, [sp, #0x50]
  43b9c4: a9064ff4     	stp	x20, x19, [sp, #0x60]
  43b9c8: aa0103f3     	mov	x19, x1
  43b9cc: 2a0003f4     	mov	w20, w0
  43b9d0: 94a3edf1     	bl	0x2d37194 <.text+0x28fc194>
  43b9d4: f9000fb3     	str	x19, [x29, #0x18]
  43b9d8: b81fc3b4     	stur	w20, [x29, #-0x4]
  43b9dc: f9000bff     	str	xzr, [sp, #0x10]
  43b9e0: 94ac7194     	bl	0x2f58030 <setsid@plt>
  43b9e4: 90ffe493     	adrp	x19, 0xcb000
  43b9e8: 2a1f03e0     	mov	w0, wzr
  43b9ec: 913dee73     	add	x19, x19, #0xf7b
  43b9f0: aa1303e1     	mov	x1, x19
  43b9f4: 94ac7193     	bl	0x2f58040 <setlocale@plt>
  43b9f8: 528000c0     	mov	w0, #0x6                // =6
  43b9fc: aa1303e1     	mov	x1, x19
  43ba00: 94ac7190     	bl	0x2f58040 <setlocale@plt>
  43ba04: 940013d7     	bl	0x440960 <.text+0x5960>
  43ba08: aa1f03e0     	mov	x0, xzr
  43ba0c: 94a4228d     	bl	0x2d44440 <.text+0x2909440>
  43ba10: 2a1f03e1     	mov	w1, wzr
  43ba14: aa0003f3     	mov	x19, x0
  43ba18: 94a4233a     	bl	0x2d44700 <.text+0x2909700>
  43ba1c: d00158e1     	adrp	x1, 0x2f59000 <ftello@plt+0xd0>
  43ba20: aa1303e0     	mov	x0, x19
  43ba24: 913ec021     	add	x1, x1, #0xfb0
  43ba28: aa1f03e2     	mov	x2, xzr
  43ba2c: 94a42339     	bl	0x2d44710 <.text+0x2909710>
  43ba30: d10013a1     	sub	x1, x29, #0x4
  43ba34: 910063a2     	add	x2, x29, #0x18
  43ba38: 910043e3     	add	x3, sp, #0x10
  43ba3c: aa1303e0     	mov	x0, x19
  43ba40: 94a42683     	bl	0x2d4544c <.text+0x290a44c>
  43ba44: f9400be8     	ldr	x8, [sp, #0x10]
  43ba48: b5001b68     	cbnz	x8, 0x43bdb4 <.text+0xdb4>
  43ba4c: f0015c88     	adrp	x8, 0x2fce000
  43ba50: b9414508     	ldr	w8, [x8, #0x144]
  43ba54: 340001a8     	cbz	w8, 0x43ba88 <.text+0xa88>
  43ba58: 94a04b8e     	bl	0x2c4e890 <.text+0x2813890>
  43ba5c: d0ffe522     	adrp	x2, 0xe1000
  43ba60: aa0003e1     	mov	x1, x0
  43ba64: f0ffe480     	adrp	x0, 0xce000
  43ba68: 910c2842     	add	x2, x2, #0x30a
  43ba6c: 912d0000     	add	x0, x0, #0xb40
  43ba70: aa0203e3     	mov	x3, x2
  43ba74: 97fffe67     	bl	0x43b410 <.text+0x410>
  43ba78: b4000053     	cbz	x19, 0x43ba80 <.text+0xa80>
  43ba7c: 940013a0     	bl	0x4408fc <.text+0x58fc>
  43ba80: 2a1f03f6     	mov	w22, wzr
  43ba84: 1400003e     	b	0x43bb7c <.text+0xb7c>
  43ba88: b4000093     	cbz	x19, 0x43ba98 <.text+0xa98>
  43ba8c: 9400139c     	bl	0x4408fc <.text+0x58fc>
  43ba90: f9400bf4     	ldr	x20, [sp, #0x10]
  43ba94: b5001c74     	cbnz	x20, 0x43be20 <.text+0xe20>
  43ba98: f0015c88     	adrp	x8, 0x2fce000
  43ba9c: 90015c79     	adrp	x25, 0x2fc7000
  43baa0: 91066108     	add	x8, x8, #0x198
  43baa4: a9400109     	ldp	x9, x0, [x8]
  43baa8: b50000a9     	cbnz	x9, 0x43babc <.text+0xabc>
  43baac: b94dab28     	ldr	w8, [x25, #0xda8]
  43bab0: 3100051f     	cmn	w8, #0x1
  43bab4: 54000041     	b.ne	0x43babc <.text+0xabc>
  43bab8: b40000a0     	cbz	x0, 0x43bacc <.text+0xacc>
  43babc: 90ffe541     	adrp	x1, 0xe3000
  43bac0: 91337c21     	add	x1, x1, #0xcdf
  43bac4: 94a44ca2     	bl	0x2d4ed4c <.text+0x2913d4c>
  43bac8: 35000120     	cbnz	w0, 0x43baec <.text+0xaec>
  43bacc: b0ffe400     	adrp	x0, 0xbc000
  43bad0: 9107d400     	add	x0, x0, #0x1f5
  43bad4: 94a44542     	bl	0x2d4cfdc <.text+0x2911fdc>
  43bad8: f0015c94     	adrp	x20, 0x2fce000
  43badc: aa0003f3     	mov	x19, x0
  43bae0: f940d280     	ldr	x0, [x20, #0x1a0]
  43bae4: 94a406f0     	bl	0x2d3d6a4 <.text+0x29026a4>
  43bae8: f900d293     	str	x19, [x20, #0x1a0]
  43baec: 94a15712     	bl	0x2c91734 <.text+0x2856734>
  43baf0: f0015c88     	adrp	x8, 0x2fce000
  43baf4: aa0003f3     	mov	x19, x0
  43baf8: f940d508     	ldr	x8, [x8, #0x1a8]
  43bafc: b4000168     	cbz	x8, 0x43bb28 <.text+0xb28>
  43bb00: 910043e1     	add	x1, sp, #0x10
  43bb04: aa0803e0     	mov	x0, x8
  43bb08: 94a14f91     	bl	0x2c8f94c <.text+0x285494c>
  43bb0c: f9400be8     	ldr	x8, [sp, #0x10]
  43bb10: b50019a8     	cbnz	x8, 0x43be44 <.text+0xe44>
  43bb14: 2a0003e1     	mov	w1, w0
  43bb18: aa1303e0     	mov	x0, x19
  43bb1c: 94a1570b     	bl	0x2c91748 <.text+0x2856748>
  43bb20: f9400bf4     	ldr	x20, [sp, #0x10]
  43bb24: b5001ad4     	cbnz	x20, 0x43be7c <.text+0xe7c>
  43bb28: f0015c94     	adrp	x20, 0x2fce000
  43bb2c: f940da80     	ldr	x0, [x20, #0x1b0]
  43bb30: b4000160     	cbz	x0, 0x43bb5c <.text+0xb5c>
  43bb34: d0ffe521     	adrp	x1, 0xe1000
  43bb38: 94001223     	bl	0x4403c4 <.text+0x53c4>
  43bb3c: 34000100     	cbz	w0, 0x43bb5c <.text+0xb5c>
  43bb40: b0ffe381     	adrp	x1, 0xac000
  43bb44: f940da80     	ldr	x0, [x20, #0x1b0]
  43bb48: 910cc821     	add	x1, x1, #0x332
  43bb4c: 94a44c80     	bl	0x2d4ed4c <.text+0x2913d4c>
  43bb50: 34000260     	cbz	w0, 0x43bb9c <.text+0xb9c>
  43bb54: aa1f03f4     	mov	x20, xzr
  43bb58: 14000017     	b	0x43bbb4 <.text+0xbb4>
  43bb5c: d0ffe521     	adrp	x1, 0xe1000
  43bb60: b0ffe440     	adrp	x0, 0xc4000
  43bb64: 910c2821     	add	x1, x1, #0x30a
  43bb68: 910b2800     	add	x0, x0, #0x2ca
  43bb6c: 9400121d     	bl	0x4403e0 <.text+0x53e0>
  43bb70: b4000053     	cbz	x19, 0x43bb78 <.text+0xb78>
  43bb74: 9400123d     	bl	0x440468 <.text+0x5468>
  43bb78: 52800096     	mov	w22, #0x4               // =4
  43bb7c: 2a1603e0     	mov	w0, w22
  43bb80: f9401bf9     	ldr	x25, [sp, #0x30]
  43bb84: a9464ff4     	ldp	x20, x19, [sp, #0x60]
  43bb88: a94557f6     	ldp	x22, x21, [sp, #0x50]
  43bb8c: a9445ff8     	ldp	x24, x23, [sp, #0x40]
  43bb90: a9427bfd     	ldp	x29, x30, [sp, #0x20]
  43bb94: 9101c3ff     	add	sp, sp, #0x70
  43bb98: d65f03c0     	ret
  43bb9c: f940da80     	ldr	x0, [x20, #0x1b0]
  43bba0: 94a406c1     	bl	0x2d3d6a4 <.text+0x29026a4>
  43bba4: f900da9f     	str	xzr, [x20, #0x1b0]
  43bba8: 94000107     	bl	0x43bfc4 <.text+0xfc4>
  43bbac: aa0003f4     	mov	x20, x0
  43bbb0: 94001274     	bl	0x440580 <.text+0x5580>
  43bbb4: f0015c88     	adrp	x8, 0x2fce000
  43bbb8: f940dd00     	ldr	x0, [x8, #0x1b8]
  43bbbc: b40000e0     	cbz	x0, 0x43bbd8 <.text+0xbd8>
  43bbc0: 910043e1     	add	x1, sp, #0x10
  43bbc4: 94a15a9c     	bl	0x2c92634 <.text+0x2857634>
  43bbc8: f9400be8     	ldr	x8, [sp, #0x10]
  43bbcc: b5001808     	cbnz	x8, 0x43becc <.text+0xecc>
  43bbd0: 2a0003f6     	mov	w22, w0
  43bbd4: 14000002     	b	0x43bbdc <.text+0xbdc>
  43bbd8: 2a1f03f6     	mov	w22, wzr
  43bbdc: 94a1ac18     	bl	0x2ca6c3c <.text+0x286bc3c>
  43bbe0: aa0003f7     	mov	x23, x0
  43bbe4: 94a1ae5e     	bl	0x2ca755c <.text+0x286c55c>
  43bbe8: aa0003f8     	mov	x24, x0
  43bbec: aa1703e0     	mov	x0, x23
  43bbf0: aa1803e1     	mov	x1, x24
  43bbf4: 94a1ac31     	bl	0x2ca6cb8 <.text+0x286bcb8>
  43bbf8: 940002e5     	bl	0x43c78c <.text+0x178c>
  43bbfc: aa0003f5     	mov	x21, x0
  43bc00: b4000078     	cbz	x24, 0x43bc0c <.text+0xc0c>
  43bc04: aa1803e0     	mov	x0, x24
  43bc08: 94a1ae9c     	bl	0x2ca7678 <.text+0x286c678>
  43bc0c: b4000057     	cbz	x23, 0x43bc14 <.text+0xc14>
  43bc10: 94001296     	bl	0x440668 <.text+0x5668>
  43bc14: f0015c97     	adrp	x23, 0x2fce000
  43bc18: f940e2e0     	ldr	x0, [x23, #0x1c0]
  43bc1c: b4000600     	cbz	x0, 0x43bcdc <.text+0xcdc>
  43bc20: d0ffe521     	adrp	x1, 0xe1000
  43bc24: 940011e8     	bl	0x4403c4 <.text+0x53c4>
  43bc28: 340002e0     	cbz	w0, 0x43bc84 <.text+0xc84>
  43bc2c: f940e2e0     	ldr	x0, [x23, #0x1c0]
  43bc30: 910043e1     	add	x1, sp, #0x10
  43bc34: 94a1bb18     	bl	0x2caa894 <.text+0x286f894>
  43bc38: f9400be8     	ldr	x8, [sp, #0x10]
  43bc3c: b5001648     	cbnz	x8, 0x43bf04 <.text+0xf04>
  43bc40: aa0003f7     	mov	x23, x0
  43bc44: 94a1ad95     	bl	0x2ca7298 <.text+0x286c298>
  43bc48: 34000360     	cbz	w0, 0x43bcb4 <.text+0xcb4>
  43bc4c: d0ffe521     	adrp	x1, 0xe1000
  43bc50: d0ffe320     	adrp	x0, 0xa1000
  43bc54: 910c2821     	add	x1, x1, #0x30a
  43bc58: 91084c00     	add	x0, x0, #0x213
  43bc5c: 940011e1     	bl	0x4403e0 <.text+0x53e0>
  43bc60: b4000057     	cbz	x23, 0x43bc68 <.text+0xc68>
  43bc64: 94001281     	bl	0x440668 <.text+0x5668>
  43bc68: b4000055     	cbz	x21, 0x43bc70 <.text+0xc70>
  43bc6c: 9400125f     	bl	0x4405e8 <.text+0x55e8>
  43bc70: 94001200     	bl	0x440470 <.text+0x5470>
  43bc74: b4000053     	cbz	x19, 0x43bc7c <.text+0xc7c>
  43bc78: 940011fc     	bl	0x440468 <.text+0x5468>
  43bc7c: 528000f6     	mov	w22, #0x7               // =7
  43bc80: 17ffffbf     	b	0x43bb7c <.text+0xb7c>
  43bc84: d0ffe521     	adrp	x1, 0xe1000
  43bc88: b0ffe400     	adrp	x0, 0xbc000
  43bc8c: 910c2821     	add	x1, x1, #0x30a
  43bc90: 91080400     	add	x0, x0, #0x201
  43bc94: 940011d3     	bl	0x4403e0 <.text+0x53e0>
  43bc98: b4000055     	cbz	x21, 0x43bca0 <.text+0xca0>
  43bc9c: 94001253     	bl	0x4405e8 <.text+0x55e8>
  43bca0: 940011f4     	bl	0x440470 <.text+0x5470>
  43bca4: b4000053     	cbz	x19, 0x43bcac <.text+0xcac>
  43bca8: 940011f0     	bl	0x440468 <.text+0x5468>
  43bcac: 528000d6     	mov	w22, #0x6               // =6
  43bcb0: 17ffffb3     	b	0x43bb7c <.text+0xb7c>
  43bcb4: aa1703e0     	mov	x0, x23
  43bcb8: 94a1ad1f     	bl	0x2ca7134 <.text+0x286c134>
  43bcbc: 94000511     	bl	0x43d100 <.text+0x2100>
  43bcc0: aa0003e1     	mov	x1, x0
  43bcc4: aa1503e0     	mov	x0, x21
  43bcc8: 94a1ad0f     	bl	0x2ca7104 <.text+0x286c104>
  43bccc: b4000057     	cbz	x23, 0x43bcd4 <.text+0xcd4>
  43bcd0: 94001266     	bl	0x440668 <.text+0x5668>
  43bcd4: f9400be8     	ldr	x8, [sp, #0x10]
  43bcd8: b5001508     	cbnz	x8, 0x43bf78 <.text+0xf78>
  43bcdc: f0015c88     	adrp	x8, 0x2fce000
  43bce0: 9104e108     	add	x8, x8, #0x138
  43bce4: b9400509     	ldr	w9, [x8, #0x4]
  43bce8: 340001e9     	cbz	w9, 0x43bd24 <.text+0xd24>
  43bcec: b9400108     	ldr	w8, [x8]
  43bcf0: 340001a8     	cbz	w8, 0x43bd24 <.text+0xd24>
  43bcf4: d0ffe521     	adrp	x1, 0xe1000
  43bcf8: d0ffe520     	adrp	x0, 0xe1000
  43bcfc: 910c2821     	add	x1, x1, #0x30a
  43bd00: 910c5800     	add	x0, x0, #0x316
  43bd04: 940011b7     	bl	0x4403e0 <.text+0x53e0>
  43bd08: b4000055     	cbz	x21, 0x43bd10 <.text+0xd10>
  43bd0c: 94001237     	bl	0x4405e8 <.text+0x55e8>
  43bd10: 940011d8     	bl	0x440470 <.text+0x5470>
  43bd14: b4000053     	cbz	x19, 0x43bd1c <.text+0xd1c>
  43bd18: 940011d4     	bl	0x440468 <.text+0x5468>
  43bd1c: 52800136     	mov	w22, #0x9               // =9
  43bd20: 17ffff97     	b	0x43bb7c <.text+0xb7c>
  43bd24: f0015c97     	adrp	x23, 0x2fce000
  43bd28: b94dab22     	ldr	w2, [x25, #0xda8]
  43bd2c: 910502f7     	add	x23, x23, #0x140
  43bd30: aa1303e4     	mov	x4, x19
  43bd34: aa1403e6     	mov	x6, x20
  43bd38: 2a1603e7     	mov	w7, w22
  43bd3c: f90003f5     	str	x21, [sp]
  43bd40: a94506e0     	ldp	x0, x1, [x23, #0x50]
  43bd44: f94032e3     	ldr	x3, [x23, #0x60]
  43bd48: f9403ae5     	ldr	x5, [x23, #0x70]
  43bd4c: b94002e8     	ldr	w8, [x23]
  43bd50: b9000be8     	str	w8, [sp, #0x8]
  43bd54: 940000fa     	bl	0x43c13c <.text+0x113c>
  43bd58: f94026e8     	ldr	x8, [x23, #0x48]
  43bd5c: aa0003f6     	mov	x22, x0
  43bd60: b4000048     	cbz	x8, 0x43bd68 <.text+0xd68>
  43bd64: 940011a5     	bl	0x4403f8 <.text+0x53f8>
  43bd68: d0000001     	adrp	x1, 0x43d000 <.text+0x2000>
  43bd6c: f0015c97     	adrp	x23, 0x2fce000
  43bd70: 91043021     	add	x1, x1, #0x10c
  43bd74: 52800040     	mov	w0, #0x2                // =2
  43bd78: f900c6f6     	str	x22, [x23, #0x188]
  43bd7c: 94ac70b5     	bl	0x2f58050 <signal@plt>
  43bd80: d0000001     	adrp	x1, 0x43d000 <.text+0x2000>
  43bd84: 528001e0     	mov	w0, #0xf                // =15
  43bd88: 91044021     	add	x1, x1, #0x110
  43bd8c: 94ac70b1     	bl	0x2f58050 <signal@plt>
  43bd90: f940c6e0     	ldr	x0, [x23, #0x188]
  43bd94: 9400011f     	bl	0x43c210 <.text+0x1210>
  43bd98: 2a0003f6     	mov	w22, w0
  43bd9c: b4000055     	cbz	x21, 0x43bda4 <.text+0xda4>
  43bda0: 94001212     	bl	0x4405e8 <.text+0x55e8>
  43bda4: 940011b3     	bl	0x440470 <.text+0x5470>
  43bda8: b4ffeeb3     	cbz	x19, 0x43bb7c <.text+0xb7c>
  43bdac: 940011af     	bl	0x440468 <.text+0x5468>
  43bdb0: 17ffff73     	b	0x43bb7c <.text+0xb7c>
  43bdb4: b4000073     	cbz	x19, 0x43bdc0 <.text+0xdc0>
  43bdb8: 940012d1     	bl	0x4408fc <.text+0x58fc>
  43bdbc: f9400be8     	ldr	x8, [sp, #0x10]
  43bdc0: b9400114     	ldr	w20, [x8]
  43bdc4: 94a42191     	bl	0x2d44408 <.text+0x2909408>
  43bdc8: f9400bf3     	ldr	x19, [sp, #0x10]
  43bdcc: 6b00029f     	cmp	w20, w0
  43bdd0: 54000181     	b.ne	0x43be00 <.text+0xe00>
  43bdd4: d0ffe522     	adrp	x2, 0xe1000
  43bdd8: d0ffe560     	adrp	x0, 0xe9000
  43bddc: 910c2842     	add	x2, x2, #0x30a
  43bde0: f9400661     	ldr	x1, [x19, #0x8]
  43bde4: 91026000     	add	x0, x0, #0x98
  43bde8: aa0203e3     	mov	x3, x2
  43bdec: 940012cf     	bl	0x440928 <.text+0x5928>
  43bdf0: aa1303e0     	mov	x0, x19
  43bdf4: 94a3d2d7     	bl	0x2d30950 <.text+0x28f5950>
  43bdf8: 52800036     	mov	w22, #0x1               // =1
  43bdfc: 17ffff60     	b	0x43bb7c <.text+0xb7c>
  43be00: b9400260     	ldr	w0, [x19]
  43be04: f9400674     	ldr	x20, [x19, #0x8]
  43be08: 94a42cba     	bl	0x2d470f0 <.text+0x290c0f0>
  43be0c: b9400667     	ldr	w7, [x19, #0x4]
  43be10: 9400114d     	bl	0x440344 <.text+0x5344>
  43be14: 52801844     	mov	w4, #0xc2               // =194
  43be18: aa1403e5     	mov	x5, x20
  43be1c: 14000066     	b	0x43bfb4 <.text+0xfb4>
  43be20: 940011b9     	bl	0x440504 <.text+0x5504>
  43be24: aa0003e6     	mov	x6, x0
  43be28: d0ffe3a0     	adrp	x0, 0xb1000
  43be2c: 90ffe502     	adrp	x2, 0xdb000
  43be30: d0ffe563     	adrp	x3, 0xe9000
  43be34: b9400687     	ldr	w7, [x20, #0x4]
  43be38: 94001156     	bl	0x440390 <.text+0x5390>
  43be3c: 528017c4     	mov	w4, #0xbe               // =190
  43be40: 1400005c     	b	0x43bfb0 <.text+0xfb0>
  43be44: b9400114     	ldr	w20, [x8]
  43be48: 94a14dbe     	bl	0x2c8f540 <.text+0x2854540>
  43be4c: 6b00029f     	cmp	w20, w0
  43be50: 540002e1     	b.ne	0x43beac <.text+0xeac>
  43be54: f9400bf4     	ldr	x20, [sp, #0x10]
  43be58: 940011be     	bl	0x440550 <.text+0x5550>
  43be5c: f9400681     	ldr	x1, [x20, #0x8]
  43be60: 940012b2     	bl	0x440928 <.text+0x5928>
  43be64: aa1403e0     	mov	x0, x20
  43be68: 94a3d2ba     	bl	0x2d30950 <.text+0x28f5950>
  43be6c: b4000053     	cbz	x19, 0x43be74 <.text+0xe74>
  43be70: 9400117e     	bl	0x440468 <.text+0x5468>
  43be74: 52800076     	mov	w22, #0x3               // =3
  43be78: 17ffff41     	b	0x43bb7c <.text+0xb7c>
  43be7c: b4000073     	cbz	x19, 0x43be88 <.text+0xe88>
  43be80: 9400117a     	bl	0x440468 <.text+0x5468>
  43be84: f9400bf4     	ldr	x20, [sp, #0x10]
  43be88: 9400119f     	bl	0x440504 <.text+0x5504>
  43be8c: b9400687     	ldr	w7, [x20, #0x4]
  43be90: aa0003e6     	mov	x6, x0
  43be94: d0ffe3a0     	adrp	x0, 0xb1000
  43be98: 90ffe502     	adrp	x2, 0xdb000
  43be9c: d0ffe563     	adrp	x3, 0xe9000
  43bea0: 9400113c     	bl	0x440390 <.text+0x5390>
  43bea4: 52801aa4     	mov	w4, #0xd5               // =213
  43bea8: 14000042     	b	0x43bfb0 <.text+0xfb0>
  43beac: b4000053     	cbz	x19, 0x43beb4 <.text+0xeb4>
  43beb0: 9400116e     	bl	0x440468 <.text+0x5468>
  43beb4: f9400bf4     	ldr	x20, [sp, #0x10]
  43beb8: 94001193     	bl	0x440504 <.text+0x5504>
  43bebc: b9400687     	ldr	w7, [x20, #0x4]
  43bec0: 94001121     	bl	0x440344 <.text+0x5344>
  43bec4: 52801ac4     	mov	w4, #0xd6               // =214
  43bec8: 1400003a     	b	0x43bfb0 <.text+0xfb0>
  43becc: 9400120f     	bl	0x440708 <.text+0x5708>
  43bed0: 6b0002bf     	cmp	w21, w0
  43bed4: 54000401     	b.ne	0x43bf54 <.text+0xf54>
  43bed8: f9400bf5     	ldr	x21, [sp, #0x10]
  43bedc: 9400119d     	bl	0x440550 <.text+0x5550>
  43bee0: f94006a1     	ldr	x1, [x21, #0x8]
  43bee4: 94001291     	bl	0x440928 <.text+0x5928>
  43bee8: aa1503e0     	mov	x0, x21
  43beec: 94a3d299     	bl	0x2d30950 <.text+0x28f5950>
  43bef0: 94001160     	bl	0x440470 <.text+0x5470>
  43bef4: b4000053     	cbz	x19, 0x43befc <.text+0xefc>
  43bef8: 9400115c     	bl	0x440468 <.text+0x5468>
  43befc: 528000b6     	mov	w22, #0x5               // =5
  43bf00: 17ffff1f     	b	0x43bb7c <.text+0xb7c>
  43bf04: d0ffe560     	adrp	x0, 0xe9000
  43bf08: f9400501     	ldr	x1, [x8, #0x8]
  43bf0c: 91027000     	add	x0, x0, #0x9c
  43bf10: f9000bff     	str	xzr, [sp, #0x10]
  43bf14: aa0803f6     	mov	x22, x8
  43bf18: 94a44486     	bl	0x2d4d130 <.text+0x2912130>
  43bf1c: d0ffe521     	adrp	x1, 0xe1000
  43bf20: aa0003f7     	mov	x23, x0
  43bf24: 910c2821     	add	x1, x1, #0x30a
  43bf28: 9400112e     	bl	0x4403e0 <.text+0x53e0>
  43bf2c: 94001204     	bl	0x44073c <.text+0x573c>
  43bf30: aa1603e0     	mov	x0, x22
  43bf34: 94a3d287     	bl	0x2d30950 <.text+0x28f5950>
  43bf38: b4000055     	cbz	x21, 0x43bf40 <.text+0xf40>
  43bf3c: 940011ab     	bl	0x4405e8 <.text+0x55e8>
  43bf40: 9400114c     	bl	0x440470 <.text+0x5470>
  43bf44: b4000053     	cbz	x19, 0x43bf4c <.text+0xf4c>
  43bf48: 94001148     	bl	0x440468 <.text+0x5468>
  43bf4c: 52800116     	mov	w22, #0x8               // =8
  43bf50: 17ffff0b     	b	0x43bb7c <.text+0xb7c>
  43bf54: 94001147     	bl	0x440470 <.text+0x5470>
  43bf58: b4000053     	cbz	x19, 0x43bf60 <.text+0xf60>
  43bf5c: 94001143     	bl	0x440468 <.text+0x5468>
  43bf60: f9400bf4     	ldr	x20, [sp, #0x10]
  43bf64: 94001168     	bl	0x440504 <.text+0x5504>
  43bf68: b9400687     	ldr	w7, [x20, #0x4]
  43bf6c: 940010f6     	bl	0x440344 <.text+0x5344>
  43bf70: 52801d64     	mov	w4, #0xeb               // =235
  43bf74: 1400000f     	b	0x43bfb0 <.text+0xfb0>
  43bf78: b4000055     	cbz	x21, 0x43bf80 <.text+0xf80>
  43bf7c: 9400119b     	bl	0x4405e8 <.text+0x55e8>
  43bf80: 9400113c     	bl	0x440470 <.text+0x5470>
  43bf84: b4000053     	cbz	x19, 0x43bf8c <.text+0xf8c>
  43bf88: 94001138     	bl	0x440468 <.text+0x5468>
  43bf8c: f9400bf4     	ldr	x20, [sp, #0x10]
  43bf90: 9400115d     	bl	0x440504 <.text+0x5504>
  43bf94: b9400687     	ldr	w7, [x20, #0x4]
  43bf98: aa0003e6     	mov	x6, x0
  43bf9c: d0ffe3a0     	adrp	x0, 0xb1000
  43bfa0: 90ffe502     	adrp	x2, 0xdb000
  43bfa4: d0ffe563     	adrp	x3, 0xe9000
  43bfa8: 940010fa     	bl	0x440390 <.text+0x5390>
  43bfac: 52801f24     	mov	w4, #0xf9               // =249
  43bfb0: aa1303e5     	mov	x5, x19
  43bfb4: 94a4060f     	bl	0x2d3d7f0 <.text+0x29027f0>
  43bfb8: 94001216     	bl	0x440810 <.text+0x5810>
  43bfbc: 12800016     	mov	w22, #-0x1              // =-1
  43bfc0: 17fffeef     	b	0x43bb7c <.text+0xb7c>
  43bfc4: a9bd7bfd     	stp	x29, x30, [sp, #-0x30]!
  43bfc8: a90157f6     	stp	x22, x21, [sp, #0x10]
  43bfcc: 910003fd     	mov	x29, sp
  43bfd0: a9024ff4     	stp	x20, x19, [sp, #0x20]
  43bfd4: d0ffe520     	adrp	x0, 0xe1000
  43bfd8: 910c2800     	add	x0, x0, #0x30a
  43bfdc: 94a4499b     	bl	0x2d4e648 <.text+0x2913648>
  43bfe0: aa0003f3     	mov	x19, x0
  43bfe4: 52808000     	mov	w0, #0x400              // =1024
  43bfe8: 94a4059e     	bl	0x2d3d660 <.text+0x2902660>
  43bfec: d0015c55     	adrp	x21, 0x2fc5000
  43bff0: aa0003f4     	mov	x20, x0
  43bff4: f9411eb5     	ldr	x21, [x21, #0x238]
  43bff8: aa1503e0     	mov	x0, x21
  43bffc: 94ac7019     	bl	0x2f58060 <feof@plt>
