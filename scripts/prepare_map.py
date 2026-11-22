#!/usr/bin/env python3
"""Optimiza el GeoTIFF EPSG:3857 para la PWA. No modifica el archivo original.

Dependencias: pip install rasterio pillow
Ejemplo: python scripts/prepare_map.py /ruta/recurso_georref.tif web/public/map/world.webp
"""
import argparse
from pathlib import Path
import rasterio
from rasterio.enums import Resampling
from PIL import Image

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("input",type=Path)
    parser.add_argument("output",type=Path)
    parser.add_argument("--width",type=int,default=4096)
    args=parser.parse_args()
    with rasterio.open(args.input) as source:
        if str(source.crs)!="EPSG:3857":
            raise SystemExit(f"Esperado EPSG:3857, encontrado {source.crs}")
        bounds=source.bounds
        wanted=(-20075000,-19250000,20074860.299720608,19250000)
        observed=(bounds.left,bounds.bottom,bounds.right,bounds.top)
        if any(abs(a-b)>2000 for a,b in zip(observed,wanted)):
            raise SystemExit("Los límites del GeoTIFF no coinciden con el mapa previsto. No se puede georreferenciar con seguridad.")
        if source.count<3:raise SystemExit("El raster debe tener al menos tres bandas RGB.")
        w=args.width
        h=round(source.height/source.width*w)
        if w<512 or w>8192:raise SystemExit("Ancho válido: 512-8192 píxeles")
        data=source.read([1,2,3],out_shape=(3,h,w),resampling=Resampling.bilinear)
        image=Image.merge("RGB",tuple(Image.fromarray(data[i]) for i in range(3)))
        args.output.parent.mkdir(parents=True,exist_ok=True)
        image.save(args.output,"WEBP",quality=78,method=5)
        print("Archivo generado:",args.output,"·",w,"x",h,"·",args.output.stat().st_size,"bytes")
        print("EPSG:3857; bounds métricos:",observed)

if __name__=="__main__":main()
