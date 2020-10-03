#! /usr/bin/env python3

import PIL.Image, json

img = PIL.Image.open('levels.png')

out = []

for sec_y in range(8):
    for sec_x in range(8):
        sector = []
        for x in range(13):
            sector.append([])
            for y in range(13):
                pix = img.getpixel((x + sec_x * 13, y + sec_y * 13))
                if pix[0] == pix[1] and pix[1] == pix[2]:
                    sector[x].append(pix[0] / 255)
                elif pix == (255, 0, 0):
                    sector[x].append(2)
                elif pix == (255, 255, 0):
                    sector[x].append(3)
                else:
                    sector[x].append(0)
        out.append(sector)
print(json.dumps(out))
