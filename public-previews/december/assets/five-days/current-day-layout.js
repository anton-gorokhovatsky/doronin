// One common lower edge for three full originals. The current-day text owns
// the space over the pair; no photograph is fitted into a foreign matte.
export default {
  id: 'queue',
  name: 'Кадр и очередь',
  layout({width, ratios, gap, rem, currentTextHeight = 0, availableHeight = Infinity}) {
    const available = Math.max(0, Number(width) || 0);
    const unit = Math.max(1, Number(rem) || 16);
    const space = Math.max(0, Number(gap) || unit * .75);
    const sources = ratios.slice(0,3).map(ratio => Number.isFinite(ratio) && ratio > 0 ? ratio : 9/16);
    if (!available || !sources.length) return {height:0,positions:[],controls:{x:0,width:0}};
    const mainRatio = sources[0];
    const widest = Math.max(...sources);

    if (available >= 36 * unit && sources.length > 1) {
      const contentWidth = available - space * (sources.length - 1);
      const narrowest = Math.min(...sources);
      const ratioSum = sources.reduce((sum,ratio)=>sum+ratio,0);
      // A portrait plus two 70%-height portraits sets the scale. The text's
      // measured height must fit above either ordering of the next pair.
      const baseHeight = contentWidth / ((9/16) * 2.4);
      const required = (contentWidth + (ratioSum-narrowest) * (currentTextHeight + space)) / ratioSum;
      const height = Math.max(required,Math.min(baseHeight,availableHeight));
      const mainWidth = height * mainRatio;
      // The pair shares both upper and lower edges. Native widths differ;
      // this releases enough headroom on a short desktop without tiny crops.
      const previewHeight = (contentWidth - mainWidth) / (ratioSum-mainRatio);
      const positions = [{x:0,y:0,width:mainWidth,height}];
      let left = mainWidth + space;
      for (const ratio of sources.slice(1)) {
        const previewWidth = previewHeight*ratio;
        positions.push({x:left,y:height-previewHeight,width:previewWidth,height:previewHeight});
        left += previewWidth + space;
      }
      return {height,positions,controls:{x:0,width:mainWidth},currentText:{x:mainWidth+space,width:available-mainWidth-space,measureWidth:available-height*widest-space}};
    }

    // A phone reserves a readable next pair even for the widest portrait.
    // The main source, lower edge and controls keep their height on selection.
    const hasQueue = sources.length > 1;
    const minimumQueue = hasQueue ? Math.min(4*unit,available*.22) : 0;
    const height = (available - (hasQueue ? space + minimumQueue : 0)) / widest;
    const mainWidth = height * mainRatio;
    const positions = [{x:0,y:0,width:mainWidth,height}];
    const rest = sources.slice(1);
    const fitQueue = rest.length ? (height-space*(rest.length-1)) / rest.reduce((sum,r)=>sum+1/r,0) : 0;
    const queueWidth = Math.min(available-mainWidth-space,fitQueue);
    const queueHeight = rest.reduce((sum,r)=>sum+queueWidth/r,0)+space*Math.max(0,rest.length-1);
    let top = height-queueHeight;
    for(const ratio of rest) {
      const itemHeight = queueWidth/ratio;
      positions.push({x:available-queueWidth,y:top,width:queueWidth,height:itemHeight});
      top += itemHeight+space;
    }
    return {height,positions,controls:{x:0,width:mainWidth}};
  },
};
