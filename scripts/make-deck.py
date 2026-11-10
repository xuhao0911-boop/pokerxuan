"""Produce scalable rank outlines from OFL Roboto Condensed; no runtime font fallback."""
from pathlib import Path
import sys,json
root=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(root/'work/font-build-deps'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
font=instantiateVariableFont(TTFont(root/'work/poker-rank.ttf'),{'wght':650})
glyphs=font.getGlyphSet(); cmap=font.getBestCmap(); result={}
for value in range(2,15):
    rank={11:'J',12:'Q',13:'K',14:'A'}.get(value,str(value))
    svg=SVGPathPen(glyphs); bounds=BoundsPen(glyphs); x=0
    for letter in rank:
        name=cmap[ord(letter)]; glyph=glyphs[name]
        glyph.draw(TransformPen(svg,(1,0,0,1,x,0)))
        glyph.draw(TransformPen(bounds,(1,0,0,1,x,0)))
        x+=glyph.width-25
    xmin,ymin,xmax,ymax=bounds.bounds
    result[value]={'d':svg.getCommands(),'x':round(xmin,2),'y':round(ymin,2),'w':round(xmax-xmin,2),'h':round(ymax-ymin,2)}
out=Path(__file__).resolve().parents[1]/'public/rank-paths.js'
out.write_text('/* Roboto Condensed outlines, SIL OFL 1.1; see RobotoCondensed-OFL.txt */\nconst RANK_PATHS='+json.dumps(result,separators=(',',':'))+';\n',encoding='utf-8')
print('Generated 13 vector ranks, including 10/J/Q/K/A')
