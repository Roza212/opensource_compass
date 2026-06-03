import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  select, 
  hierarchy, 
  tree as d3tree, 
  zoom as d3zoom, 
  zoomIdentity 
} from 'd3';
import { fetchTree } from '../api/client';
import { Loader2, RefreshCw, X, Copy, Check, MessageSquare, ArrowRight, FileText, Zap, Maximize, MousePointer2 } from 'lucide-react';

const LANG_COLORS = {
  'python': '#1D9E75',
  'javascript': '#BA7517',
  'typescript': '#BA7517',
  'go': '#185FA5',
  'rust': '#D85A30',
  'markdown': '#888780',
  'json': '#888780',
  'yaml': '#888780',
  'default': '#7F77DD'
};

const TreeDiagram = ({ repoName, onAskAI }) => {
  const svgRef = useRef();
  const minimapCanvasRef = useRef();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Tooltip State
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: null });

  const d3UpdateRef = useRef(null);
  const nodesMapRef = useRef(new Map());
  const rootRef = useRef(null);
  const gContainerRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const currentTransformRef = useRef(zoomIdentity);
  const treeBoundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchTree(repoName);
      setData(result.tree);
      setStats(result.stats);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [repoName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getNodeColor = (d) => {
    const lang = d.data.metadata?.language?.toLowerCase();
    if (d.data.id === repoName || lang === 'root') return 'var(--neon-purple)';
    return LANG_COLORS[lang] || LANG_COLORS['default'];
  };

  const getNodeRadius = (d) => {
    const loc = d.data.metadata?.loc || 0;
    if (loc < 50) return 5;
    if (loc < 200) return 7;
    if (loc < 500) return 9;
    return 11;
  };

  // --- Minimap Rendering Logic ---
  const drawMinimap = useCallback(() => {
    if (!minimapCanvasRef.current || !rootRef.current) return;
    const canvas = minimapCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const nodes = rootRef.current.descendants();
    const links = rootRef.current.links();
    const transform = currentTransformRef.current;

    const mWidth = 160;
    const mHeight = 120;
    const padding = 10;

    // Calculate bounds of the tree nodes (note: x is vertical, y is horizontal in our layout)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(d => {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    });

    // Store bounds for click-to-pan
    treeBoundsRef.current = { minX, maxX, minY, maxY };

    const treeW = maxY - minY;
    const treeH = maxX - minX;
    
    // Scaling factor to fit tree in minimap
    const scale = Math.min((mWidth - padding * 2) / treeW, (mHeight - padding * 2) / treeH);
    const offsetX = padding - minY * scale;
    const offsetY = padding - minX * scale;

    ctx.clearRect(0, 0, mWidth, mHeight);

    // Draw Links
    ctx.strokeStyle = 'var(--border-light)';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    links.forEach(l => {
      ctx.moveTo(l.source.y * scale + offsetX, l.source.x * scale + offsetY);
      ctx.lineTo(l.target.y * scale + offsetX, l.target.x * scale + offsetY);
    });
    ctx.stroke();

    // Draw Nodes
    ctx.globalAlpha = 1.0;
    nodes.forEach(d => {
      ctx.fillStyle = getNodeColor(d);
      ctx.beginPath();
      ctx.arc(d.y * scale + offsetX, d.x * scale + offsetY, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw Viewport Rect
    // The viewport coordinates in the tree space:
    // Left edge: (0 - transform.x) / transform.k
    // Top edge: (0 - transform.y) / transform.k
    const svgW = svgRef.current.clientWidth;
    const svgH = svgRef.current.clientHeight;

    const vMinY = (0 - transform.x) / transform.k;
    const vMaxY = (svgW - transform.x) / transform.k;
    const vMinX = (0 - transform.y) / transform.k;
    const vMaxX = (svgH - transform.y) / transform.k;

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    
    const rectX = vMinY * scale + offsetX;
    const rectY = vMinX * scale + offsetY;
    const rectW = (vMaxY - vMinY) * scale;
    const rectH = (vMaxX - vMinX) * scale;

    ctx.strokeRect(rectX, rectY, rectW, rectH);
    ctx.fillRect(rectX, rectY, rectW, rectH);

    // Save mapping data for click handler
    canvas.dataset.scale = scale;
    canvas.dataset.offsetX = offsetX;
    canvas.dataset.offsetY = offsetY;
  }, [selectedNode, data]);

  const handleMinimapClick = (event) => {
    if (!minimapCanvasRef.current || !zoomBehaviorRef.current) return;
    const canvas = minimapCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const scale = parseFloat(canvas.dataset.scale);
    const offsetX = parseFloat(canvas.dataset.offsetX);
    const offsetY = parseFloat(canvas.dataset.offsetY);

    // Convert click to tree coordinates
    const targetTreeY = (clickX - offsetX) / scale;
    const targetTreeX = (clickY - offsetY) / scale;

    const svgW = svgRef.current.clientWidth;
    const svgH = svgRef.current.clientHeight;
    const k = currentTransformRef.current.k;

    // Pan main tree to center these coordinates
    const tx = svgW / 2 - targetTreeY * k;
    const ty = svgH / 2 - targetTreeX * k;

    select(svgRef.current).transition().duration(500).call(
      zoomBehaviorRef.current.transform,
      zoomIdentity.translate(tx, ty).scale(k)
    );
  };

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight || 800;
    const margin = { top: 20, right: 250, bottom: 20, left: 100 };

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const gContainer = svg.append("g");
    gContainerRef.current = gContainer;

    const zoomBehavior = d3zoom()
      .scaleExtent([0.05, 3])
      .on("zoom", (event) => {
        gContainer.attr("transform", event.transform);
        currentTransformRef.current = event.transform;
        drawMinimap();
        svg.style("cursor", event.sourceEvent?.type === 'mousemove' ? 'grabbing' : 'grab');
      })
      .on("end", () => {
        svg.style("cursor", "grab");
      });

    zoomBehaviorRef.current = zoomBehavior;
    svg.call(zoomBehavior);

    const root = hierarchy(data);
    rootRef.current = root;
    nodesMapRef.current.clear();

    if (root.children) {
      root.children.forEach(child => {
        if (child.children) {
          child._children = child.children;
          child.children = null;
        }
      });
    }

    const treemap = d3tree().nodeSize([50, 300]); 

    const update = (source) => {
      const treeData = treemap(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      nodes.forEach(d => {
        nodesMapRef.current.set(d.data.id, d);
      });

      // Links
      const link = gContainer.selectAll('path.link')
        .data(links, d => d.target.id);

      const linkEnter = link.enter().insert('path', "g")
        .attr('class', 'link')
        .style("fill", "none")
        .style("stroke", "var(--border-light)")
        .style("stroke-width", d => d.source.depth === 0 ? "1.5px" : (d.source.depth === 1 ? "1px" : "0.5px"))
        .style("opacity", d => d.source.depth === 0 ? 0.6 : (d.source.depth === 1 ? 0.45 : 0.3));

      linkEnter.merge(link).transition().duration(450)
        .attr('d', d => diagonal(d.source, d.target));

      link.exit().remove();

      // Nodes
      const node = gContainer.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = Math.random().toString(36).substr(2, 9)));

      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
        .on('click', (event, d) => {
          setSelectedNode(d.data);
          setIsPanelOpen(true);
          if (d.children) { d._children = d.children; d.children = null; }
          else if (d._children) { d.children = d._children; d._children = null; }
          update(d);
        })
        .on('mousemove', (event, d) => {
            setTooltip({ show: true, x: event.clientX + 12, y: event.clientY, content: { name: d.data.name, language: d.data.metadata?.language, loc: d.data.metadata?.loc }});
        })
        .on('mouseleave', () => setTooltip(prev => ({ ...prev, show: false })));

      nodeEnter.append('circle').attr('class', 'highlight-ring').style("fill", "transparent").style("stroke-width", "2px").style("opacity", 0);
      nodeEnter.append('circle').attr('class', 'node-circle').attr('r', 1e-6).style("stroke-width", "1.5px");
      nodeEnter.append('text').attr("dy", ".35em").style("fill", "var(--text-muted)").style("font-size", "13px").style("pointer-events", "none").style("fill-opacity", 1e-6);

      const nodeUpdate = nodeEnter.merge(node);
      nodeUpdate.transition().duration(450).attr("transform", d => `translate(${d.y},${d.x})`);

      nodeUpdate.select('circle.node-circle')
        .attr('r', d => (selectedNode && d.data.id === selectedNode.id) ? 10 : getNodeRadius(d))
        .style("fill", d => d._children ? getNodeColor(d) : (d.children ? "transparent" : getNodeColor(d) + '33'))
        .style("stroke", getNodeColor);

      nodeUpdate.select('circle.highlight-ring')
        .attr('r', d => getNodeRadius(d) + 10)
        .style("stroke", getNodeColor)
        .style("opacity", d => (selectedNode && d.data.id === selectedNode.id) ? 0.5 : 0);

      nodeUpdate.select('text')
        .attr("x", d => d.children || d._children ? -18 : 18)
        .attr("text-anchor", d => d.children || d._children ? "end" : "start")
        .text(d => d.data.name)
        .style("fill-opacity", 1)
        .style("font-weight", d => (selectedNode && d.data.id === selectedNode.id) ? "700" : "400")
        .style("fill", d => (selectedNode && d.data.id === selectedNode.id) ? "#f8fafc" : "var(--text-muted)");

      node.exit().remove();

      nodes.forEach(d => { d.x0 = d.x; d.y0 = d.y; });
      function diagonal(s, t) { return `M ${s.y} ${s.x} C ${(s.y + t.y) / 2} ${s.x}, ${(s.y + t.y) / 2} ${t.x}, ${t.y} ${t.x}`; }

      // Update minimap after tree update
      drawMinimap();
    };

    d3UpdateRef.current = update;
    update(root);

    const initialTransform = zoomIdentity.translate(margin.left, height / 2).scale(0.8);
    svg.call(zoomBehavior.transform, initialTransform);

    window.resetTreeZoom = () => svg.transition().duration(750).call(zoomBehavior.transform, initialTransform);
    window.navigateToNode = (nodeId) => {
      const targetNode = nodesMapRef.current.get(nodeId);
      if (targetNode) {
        let curr = targetNode;
        while (curr.parent) { if (curr.parent._children) { curr.parent.children = curr.parent._children; curr.parent._children = null; } curr = curr.parent; }
        update(targetNode);
        setSelectedNode(targetNode.data);
        setIsPanelOpen(true);
        const scale = 1.0;
        const x = -targetNode.y * scale + (isPanelOpen ? width * 0.3 : width * 0.5);
        const y = -targetNode.x * scale + height / 2;
        svg.transition().duration(750).call(zoomBehavior.transform, zoomIdentity.translate(x, y).scale(scale));
      }
    };
  }, [data, selectedNode, drawMinimap]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-main)] text-slate-400 gap-4 min-h-[600px]">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-sm font-medium animate-pulse">Mapping codebase architecture...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[var(--bg-main)] text-red-400 gap-2 px-8 text-center min-h-[600px]">
      <p className="font-semibold text-lg">Visualization failed</p>
      <p className="text-sm opacity-70 max-w-md">{error}</p>
      <button onClick={loadData} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-xs hover:bg-slate-700 transition-colors">Retry Analysis</button>
    </div>
  );

  return (
    <div className="flex w-full h-full min-h-[600px] bg-[var(--bg-main)] relative">
      {/* Tooltip */}
      {tooltip.show && tooltip.content && (
        <div 
          className="fixed z-[100] bg-slate-900/95 border border-slate-700 rounded-lg p-3 shadow-2xl pointer-events-none backdrop-blur-md transition-opacity duration-200"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translateY(-50%)' }}
        >
          <div className="text-xs font-bold text-slate-100 mb-1">{tooltip.content.name}</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: LANG_COLORS[tooltip.content.language?.toLowerCase()] || LANG_COLORS['default'] }} />
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{tooltip.content.language}</div>
            <div className="text-[10px] text-slate-500">•</div>
            <div className="text-[10px] text-slate-400 font-bold">{tooltip.content.loc} lines</div>
          </div>
        </div>
      )}

      {/* Diagram Canvas Area */}
      <div className={`relative h-full transition-all duration-500 ease-in-out ${isPanelOpen ? 'md:w-[65%]' : 'w-full'}`}>
        {/* Floating Controls */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-3">
          <div className="bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl flex flex-row md:flex-col gap-1">
            <button
              onClick={() => window.resetTreeZoom && window.resetTreeZoom()}
              className="p-2 md:p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
              title="Reset View"
            >
              <Maximize size={20} />
            </button>
            <button
              onClick={loadData}
              className="p-2 md:p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Language Legend */}
        <div className="absolute bottom-6 left-6 z-10 bg-slate-900/60 backdrop-blur-md p-3 rounded-xl border border-slate-800/50 shadow-xl">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">Language Legend</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {Object.entries(LANG_COLORS).filter(([key]) => key !== 'default').map(([lang, color]) => (
                    <div key={lang} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[10px] text-slate-400 capitalize font-medium">{lang}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Minimap Overview */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-1">Overview</span>
          <div className="bg-slate-900/80 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-2xl overflow-hidden cursor-crosshair">
            <canvas 
              ref={minimapCanvasRef} 
              width="160" 
              height="120" 
              className="rounded-lg"
              onClick={handleMinimapClick}
            />
          </div>
        </div>
        
        <svg ref={svgRef} className="w-full h-full block" />
      </div>

      {/* Slide-out Detail Panel */}
      <div className={`
        fixed md:relative top-0 right-0 h-full 
        bg-slate-900/95 md:backdrop-blur-xl backdrop-blur-2xl
        border-l border-slate-800 transition-all duration-500 ease-in-out 
        overflow-y-auto z-40
        ${isPanelOpen ? 'w-full md:w-[35%] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-full md:translate-x-0 pointer-events-none'}
      `}>
        {selectedNode && (
          <div className="p-8 pb-12">
            <div className="flex justify-between items-start mb-8">
              <div className="flex-1 min-w-0 mr-4">
                <div className="flex items-center gap-2 mb-2">
                   <FileText size={18} style={{ color: getNodeColor({ data: selectedNode }) }} className="flex-shrink-0" />
                   <h3 className="text-xl font-bold text-slate-100 truncate tracking-tight">{selectedNode.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider`} style={{ backgroundColor: getNodeColor({ data: selectedNode }) + '33', color: getNodeColor({ data: selectedNode }) }}>
                    {selectedNode.metadata.language}
                  </span>
                  <span className="text-slate-500 text-xs font-semibold">{selectedNode.metadata.loc} Lines</span>
                </div>
              </div>
              <button 
                onClick={() => setIsPanelOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-slate-300 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
                <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Project Path</label>
                <div className="flex items-center gap-3">
                  <code className="text-xs text-slate-400 break-all font-mono leading-relaxed flex-1">{selectedNode.path}</code>
                  <button 
                    onClick={() => copyToClipboard(selectedNode.path)}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-300 transition-all flex-shrink-0"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-800/40 text-center">
                  <div className="text-slate-500 text-[10px] font-bold uppercase mb-2">Imports</div>
                  <div className="text-3xl font-black text-slate-200">{selectedNode.metadata.imports}</div>
                </div>
                <div className="bg-slate-800/20 p-5 rounded-2xl border border-slate-800/40 text-center">
                  <div className="text-slate-500 text-[10px] font-bold uppercase mb-2">Dependents</div>
                  <div className="text-3xl font-black text-slate-200">{selectedNode.dependents?.length || 0}</div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Internal Dependencies</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.children?.length > 0 ? (
                      selectedNode.children.map(child => (
                        <button 
                          key={child.id}
                          onClick={() => window.navigateToNode && window.navigateToNode(child.id)}
                          className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 rounded-xl text-xs text-slate-300 flex items-center gap-2 transition-all"
                        >
                          <ArrowRight size={12} style={{ color: getNodeColor({ data: child }) }} />
                          {child.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600 italic">This file has no internal imports.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Required By</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedNode.dependents?.length > 0 ? (
                      selectedNode.dependents.map(dep => (
                        <button 
                          key={dep}
                          onClick={() => window.navigateToNode && window.navigateToNode(dep)}
                          className="px-3 py-1.5 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 rounded-xl text-xs text-slate-300 transition-all"
                        >
                          {dep.split('/').pop()}
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-slate-600 italic">No other files import this one.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  onClick={() => onAskAI && onAskAI(`Explain what ${selectedNode.name} does and its role in the codebase`)}
                  className="w-full group relative py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-2xl shadow-purple-900/40"
                >
                  <Zap size={20} className="fill-yellow-400 text-yellow-400 group-hover:scale-125 transition-transform" />
                  <span>Explain with AI</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TreeDiagram;
