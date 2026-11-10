// All normal raise sizes use half-BB ticks; the last tick may be an exact all-in.
globalThis.BetSizing={
 range(min,max){min=Math.min(min,max);return {min,max,first:Math.min(Math.ceil(min/50)*50,Math.ceil(max/50)*50),end:Math.ceil(max/50)*50,step:50};},
 snap(value,min,max){if(max<=min||value>=max)return max;const first=Math.ceil(min/50)*50;if(first>max)return max;return Math.max(first,Math.min(max,Math.round((Number(value)||0)/50)*50));}
};
