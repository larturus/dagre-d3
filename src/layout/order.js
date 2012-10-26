dagre.layout.order = (function() {
  function crossCount(g, layering) {
    var cc = 0;
    var prevLayer;
    layering.forEach(function(layer) {
      if (prevLayer) {
        cc += bilayerCrossCount(g, prevLayer, layer);
      }
      prevLayer = layer;
    });
    return cc;
  }

  /*
   * This function searches through a ranked and ordered graph and counts the
   * number of edges that cross. This algorithm is derived from:
   *
   *    W. Barth et al., Bilayer Cross Counting, JGAA, 8(2) 179–194 (2004)
   */
  function bilayerCrossCount(g, layer1, layer2) {
    var layer2Pos = {};
    layer2.forEach(function(u, i) { layer2Pos[u] = i; });

    var edgeIndices = [];
    layer1.forEach(function(u) {
      var nodeEdges = [];
      g.neighbors(u).forEach(function(v) {
        var pos = layer2Pos[v];
        if (pos !== undefined) {
          nodeEdges.push(pos);
        }
      });
      // TODO consider radix sort
      nodeEdges.sort(function(x, y) { return x - y; });
      edgeIndices = edgeIndices.concat(nodeEdges);
    });

    var firstIndex = 1;
    while (firstIndex < layer2.length) {
      firstIndex <<= 1;
    }

    var treeSize = 2 * firstIndex - 1;
    firstIndex -= 1;

    var tree = [];
    for (var i = 0; i < treeSize; ++i) { tree[i] = 0; }

    var cc = 0;
    edgeIndices.forEach(function(i) {
      var treeIndex = i + firstIndex;
      tree[treeIndex]++;
      while (treeIndex > 0) {
        if (treeIndex % 2) {
          cc += tree[treeIndex + 1];
        }
        treeIndex = (treeIndex - 1) >> 1;
        tree[treeIndex]++;
      }
    });

    return cc;
  }

  function initOrder(g, nodeMap) {
    var layering = [];
    var visited = {};

    function dfs(u) {
      if (u in visited) {
        return;
      }
      visited[u] = true;

      var rank = nodeMap[u].rank;
      for (var i = layering.length; i <= rank; ++i) {
        layering[i] = [];
      }
      layering[rank].push(u);

      g.neighbors(u).forEach(function(v) {
        dfs(v);
      });
    }

    g.nodes().forEach(function(u) {
      if (nodeMap[u].rank === 0) {
        dfs(u);
      }
    });

    return layering;
  }

  function improveOrdering(g, i, layering) {
    if (i % 2 === 0) {
      for (var j = 1; j < layering.length; ++j) {
        improveLayer(g, i, layering[j - 1], layering[j]);
      }
    } else {
      for (var j = layering.length - 2; j >= 0; --j) {
        improveLayer(g, i, layering[j + 1], layering[j]);
      }
    }
  }

  /*
   * Given a fixed layer and a movable layer in a graph this function will
   * attempt to find an improved ordering for the movable layer such that
   * edge crossings may be reduced.
   *
   * This algorithm is based on the barycenter method.
   */
  function improveLayer(g, i, fixed, movable) {
    var weights = rankWeights(g, fixed, movable);

    var toSort = [];

    movable.forEach(function(u, i) {
      var weight = weights[u];
      if (weight !== -1) {
        toSort.push({node: u, weight: weight, pos: i});
      }
    });

    toSort.sort(function(x, y) {
      var d = x.weight - y.weight;
      if (d === 0) {
        return x.pos - y.pos;
      }
      return d;
    });

    var toSortIndex = 0;
    for (var i = 0; i < movable.length; ++i) {
      var u = movable[i];
      var weight = weights[u];
      if (weight !== -1) {
        movable[i] = toSort[toSortIndex++].node;
      }
    }
  }

  /*
   * Given a fixed layer and a movable layer in a graph, this function will
   * return weights for the movable layer that can be used to reorder the layer
   * for potentially reduced edge crossings.
   */
  function rankWeights(g, fixed, movable) {
    var fixedPos = {};
    fixed.forEach(function(u, i) { fixedPos[u] = i; });

    var weights = {};
    movable.forEach(function(u) {
      var weight;
      var adjCount = 0;
      g.neighbors(u).forEach(function(v) {
        var vPos = fixedPos[v];
        if (vPos !== undefined) {
          if (!adjCount) { weight = 0; }
          weight += vPos;
          ++adjCount;
        }
      });
      weights[u] = adjCount ? weight / adjCount : -1;
    });

    return weights;
  }

  function copyLayering(layering) {
    return layering.map(function(l) { return l.slice(0); });
  }

  return function(g, orderIters, nodeMap) {
    var layering = initOrder(g, nodeMap);
    var bestLayering = copyLayering(layering);
    var bestCC = crossCount(g, layering);

    var cc;
    for (var i = 0; i < orderIters; ++i) {
      improveOrdering(g, i, layering);
      cc = crossCount(g, layering);
      if (cc < bestCC) {
        bestLayering = copyLayering(layering);
        bestCC = cc;
      }
    }

    return bestLayering;
  }
})();
