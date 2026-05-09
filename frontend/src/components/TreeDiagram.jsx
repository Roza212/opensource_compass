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

  // Helper for node coloring
  const getNodeColor = (d) => {
    const lang = d.data.metadata?.language?.toLowerCase();
    if (d.data.id === repoName || lang === 'root') return '#8b5cf6';
    return LANG_COLORS[lang] || LANG_COLORS['default'];
  };

  // Helper for node sizing
  const getNodeRadius = (d) => {
    const loc = d.data.metadata?.loc || 0;
    if (loc < 50) return 5;
    if (loc < 200) return 7;
    if (loc < 500) return 9;
    return 11;
  };

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight || 800;
    const margin = { top: 20, right: 250, bottom: 20, left: 100 };

    const svg = select(svgRef.current)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("background", "transparent")
      .style("cursor", "grab");

    svg.selectAll("*").remove();

    const gContainer = svg.append("g");
    gContainerRef.current = gContainer;

    const zoomBehavior = d3zoom()
      .scaleExtent([0.05, 3])
      .on("zoom", (event) => {
        gContainer.attr("transform", event.transform);
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

      // --- Links ---
      const link = gContainer.selectAll('path.link')
        .data(links, d => d.target.id);

      const linkEnter = link.enter().insert('path', "g")
        .attr('class', 'link')
        .attr('d', d => {
          const o = { x: source.x0 || 0, y: source.y0 || 0 };
          return diagonal(o, o);
        })
        .style("fill", "none")
        .style("stroke", "#4b5563")
        .style("stroke-width", d => {
            if (d.source.depth === 0) return "1.5px";
            if (d.source.depth === 1) return "1px";
            return "0.5px";
        })
        .style("opacity", d => {
            if (d.source.depth === 0) return 0.6;
            if (d.source.depth === 1) return 0.45;
            return 0.3;
        });

      const linkUpdate = linkEnter.merge(link);

      linkUpdate.transition()
        .duration(450)
        .attr('d', d => diagonal(d.source, d.target));

      link.exit().transition()
        .duration(450)
        .attr('d', d => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // --- Nodes ---
      const node = gContainer.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = Math.random().toString(36).substr(2, 9)));

      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr("transform", d => `translate(${source.y0 || 0},${source.x0 || 0})`)
        .on('click', (event, d) => {
          setSelectedNode(d.data);
          setIsPanelOpen(true);
          
          if (d.children) {
            d._children = d.children;
            d.children = null;
          } else if (d._children) {
            d.children = d._children;
            d._children = null;
          }
          update(d);
        })
        .on('mousemove', (event, d) => {
            setTooltip({
                show: true,
                x: event.clientX + 12,
                y: event.clientY,
                content: {
                    name: d.data.name,
                    language: d.data.metadata?.language,
                    loc: d.data.metadata?.loc
                }
            });
        })
        .on('mouseleave', () => {
            setTooltip(prev => ({ ...prev, show: false }));
        });

      // Selection Ring
      nodeEnter.append('circle')
        .attr('class', 'highlight-ring')
        .attr('r', d => getNodeRadius(d) + 10)
        .style("fill", "transparent")
        .style("stroke", getNodeColor)
        .style("stroke-width", "2px")
        .style("opacity", 0);

      // Node Circle
      nodeEnter.append('circle')
        .attr('class', 'node-circle')
        .attr('r', 1e-6)
        .style("stroke", getNodeColor)
        .style("stroke-width", "1.5px")
        .style("fill", d => d._children ? getNodeColor(d) : "#0f172a");

      // Node Label
      nodeEnter.append('text')
        .attr("dy", ".35em")
        .attr("x", d => d.children || d._children ? -18 : 18)
        .attr("text-anchor", d => d.children || d._children ? "end" : "start")
        .text(d => d.data.name)
        .style("fill", "#cbd5e1")
        .style("font-size", "13px")
        .style("font-family", "Inter, sans-serif")
        .style("pointer-events", "none")
        .style("fill-opacity", 1e-6);

      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate.transition()
        .duration(450)
        .attr("transform", d => `translate(${d.y},${d.x})`);

      nodeUpdate.select('circle.node-circle')
        .attr('r', d => (selectedNode && d.data.id === selectedNode.id) ? 10 : getNodeRadius(d))
        .style("fill", d => d._children ? getNodeColor(d) : (d.children ? "transparent" : getNodeColor(d) + '33')) // 33 for 20% opacity
        .style("stroke", getNodeColor);

      nodeUpdate.select('circle.highlight-ring')
        .attr('r', d => getNodeRadius(d) + 10)
        .style("stroke", getNodeColor)
        .style("opacity", d => (selectedNode && d.data.id === selectedNode.id) ? 0.5 : 0);

      nodeUpdate.select('text')
        .style("fill-opacity", 1)
        .style("font-weight", d => (selectedNode && d.data.id === selectedNode.id) ? "700" : "400")
        .style("fill", d => (selectedNode && d.data.id === selectedNode.id) ? "#f8fafc" : "#cbd5e1");

      const nodeExit = node.exit().transition()
        .duration(450)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

      nodeExit.select('circle').attr('r', 1e-6);
      nodeExit.select('text').style("fill-opacity", 1e-6);

      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });

      function diagonal(s, t) {
        return `M ${s.y} ${s.x}
                C ${(s.y + t.y) / 2} ${s.x},
                  ${(s.y + t.y) / 2} ${t.x},
                  ${t.y} ${t.x}`;
      }
    };

    d3UpdateRef.current = update;
    update(root);

    const initialTransform = zoomIdentity.translate(margin.left, height / 2).scale(0.8);
    svg.call(zoomBehavior.transform, initialTransform);

    window.resetTreeZoom = () => {
      svg.transition().duration(750).call(zoomBehavior.transform, initialTransform);
    };

    window.navigateToNode = (nodeId) => {
      const targetNode = nodesMapRef.current.get(nodeId);
      if (targetNode) {
        let curr = targetNode;
        while (curr.parent) {
          if (curr.parent._children) {
            curr.parent.children = curr.parent._children;
            curr.parent._children = null;
          }
          curr = curr.parent;
        }
        
        update(targetNode);
        setSelectedNode(targetNode.data);
        setIsPanelOpen(true);
        
        const scale = 1.0;
        const x = -targetNode.y * scale + (isPanelOpen ? width * 0.3 : width * 0.5);
        const y = -targetNode.x * scale + height / 2;
        
        svg.transition().duration(750).call(
          zoomBehavior.transform, 
          zoomIdentity.translate(x, y).scale(scale)
        );
      }
    };

  }, [data, selectedNode]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Determine which languages to show in legend
  const presentLanguages = useMemo(() => {
    if (!stats?.languages) return [];
    const keys = Object.keys(stats.languages);
    // Map extensions back to friendly names or just use what we have in metadata
    // For simplicity, I'll just check common names
    const names = ['python', 'javascript', 'typescript', 'go', 'rust', 'markdown', 'json', 'yaml'];
    return names.filter(name => {
        // Find if this name exists as a language in the repo
        return stats.languages[name] || stats.languages[name.substring(0,2)]; 
    });
  }, [stats]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0f172a] text-slate-400 gap-4 min-h-[600px]">
      <Loader2 className="animate-spin text-purple-500" size={40} />
      <p className="text-sm font-medium animate-pulse">Mapping codebase architecture...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#0f172a] text-red-400 gap-2 px-8 text-center min-h-[600px]">
      <p className="font-semibold text-lg">Visualization failed</p>
      <p className="text-sm opacity-70 max-w-md">{error}</p>
      <button onClick={loadData} className="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-xs hover:bg-slate-700 transition-colors">Retry Analysis</button>
    </div>
  );

  return (
    <div className="flex w-full h-full min-h-[600px] bg-[#0b1120] relative">
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

        {/* Navigation Help */}
        <div className="absolute bottom-6 right-6 z-10 hidden md:block">
           <div className="bg-slate-900/40 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-800/50 flex items-center gap-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                <MousePointer2 size={12} className="text-blue-400" /> Hover for info
              </span>
              <div className="w-px h-3 bg-slate-800" />
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Scroll to zoom
              </span>
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
