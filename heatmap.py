import logging
import os
from string import Template

import branca.colormap as cm
import folium
import matplotlib.colors as colors
import numpy as np
import xyzservices.providers as xyz
from heatchmap.gpmap import GPMap
from heatchmap.map_based_model import BOUNDARIES, BUCKETS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BUCKETS = BUCKETS[:-1]
BOUNDARIES = BOUNDARIES[:-1]


outname = "index.html"
template_path = "index_template.html"

tiles = xyz.CartoDB.Positron
folium_map = folium.Map(
    tiles=folium.TileLayer(no_wrap=True, tiles=tiles),
    min_zoom=1,
    max_zoom=5,
)

# append to attribution
folium.TileLayer(
    tiles=tiles,
    name="Map",
    attr="&copy;<br>Made by <a href='https://tillwenke.github.io/'>Till Wenke</a><br>Code on <a href='https://github.com/Hitchwiki/hitchhiking.org/blob/main/heatmap.py'>GitHub</a>",
    no_wrap=True,
).add_to(folium_map)


cmap = colors.ListedColormap(BUCKETS)

norm = colors.BoundaryNorm(BOUNDARIES, cmap.N, clip=True)
cmap.set_bad(color="#000000", alpha=0.0)  # opaque for NaN values (sea)

gpmap = GPMap()
gpmap.get_map_grid()
gpmap.get_landmass_raster()

image = gpmap.raw_raster
image = np.where(gpmap.landmass_raster, image, np.nan)
image = norm(image).data
# Apply the colormap to scalars
colors = cmap(image)

uncertainties = gpmap.uncertainties
# no uncertainties for sea -> becomes fully transparent
uncertainties = np.where(gpmap.landmass_raster, uncertainties, uncertainties.max())
# Normalize uncertainties
uncertainties = (uncertainties - uncertainties.min()) / (uncertainties.max() - uncertainties.min())
uncertainties = 1 - uncertainties

# Combine RGB values with the opacity
rgba_array = np.empty_like(colors)
rgba_array[:, :, :3] = colors[:, :, :3]  # RGB
rgba_array[:, :, 3] = uncertainties

folium.raster_layers.ImageOverlay(
    image=rgba_array,
    bounds=[[-56, -180], [80, 180]],
).add_to(folium_map)


legend = cm.LinearColormap(colors=BUCKETS, index=BOUNDARIES[:-1], vmin=BOUNDARIES[0], vmax=BOUNDARIES[-1])
legend.caption = "Waiting time to catch a ride by hitchhiking (minutes)"
folium_map.add_child(legend)

### from hitchmap.com show.py ###
folium_map.get_root().render()

header = folium_map.get_root().header.render()
header = header.replace(
    '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css"/>',
    '<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">',
)

body = folium_map.get_root().html.render()
script = folium_map.get_root().script.render()

with (
    open(template_path, encoding="utf-8") as template,
    open(outname, "w", encoding="utf-8") as out,
):
    output = Template(template.read()).substitute(
        {
            "folium_head": header,
            "folium_body": body,
            "folium_script": script,
        }
    )

    out.write(output)

logger.info(f"Map saved to {outname}")
logger.info("Done.")
