// @flow
/* eslint react/no-find-dom-node: 0 */
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import styles from './Grid.css';

type Props<T> = {
  columnWidth: number,
  comp: () => void,
  gutterWidth: number,
  items: T[],
  minCols: number,
  loadItems: () => void,
  scrollContainer: HTMLElement,
};

type GridItemType<T> = {
  component: {},
  key: number,
  itemData: T,
  column: number,
  width: number,
  height: number,
  left: number,
  top: number,
  bottom: number,
};

function distance(a, b) {
  const x = a.x - b.x;
  const y = a.y - b.y;
  return Math.sqrt((x * x) + (y * y));
}

export default class TenzingGrid<T> extends Component {
  static defaultProps: {};

  constructor(props: Props<*>) {
    super(props);

    this.insertedItemsCount = 0;

    this.state = {
      height: 0,
      gridItems: [],
      minHeight: 0,
    };
  }

  state: {
    height: number,
    gridItems: Array<*>,
    minHeight: number,
  };

  /**
   * Adds hooks after the component mounts.
   */
  componentDidMount() {
    this.boundResizeHandler = () => this.handleResize();

    this.props.scrollContainer.addEventListener('scroll', this.handleScroll);
    this.props.scrollContainer.addEventListener('resize', this.boundResizeHandler);

    this.updateItems(this.props.items);
  }

  componentWillReceiveProps({ items }: { items: Array<*> }) {
    this.updateItems(items);
  }

  /**
   * Sets the height of the grid after the component updates.
   * This allows stacking of items under the grid due to absolutely positioned elements.
   */
  componentDidUpdate() {
    setTimeout(() => {
      this.scrollBuffer = this.getContainerHeight() * 2;
    });
  }

  /**
   * Remove listeners when unmounting.
   */
  componentWillUnmount() {
    this.props.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.props.scrollContainer.removeEventListener('resize', this.boundResizeHandler);
  }

  /**
   * Returns the container height.
   */
  getContainerHeight() {
    const container = this.props.scrollContainer;
    return container.clientHeight || container.innerHeight;
  }


  getItemsRelatedTo(colIdx: number, iIdx: number, noItems: number = 5) {
    const { gridItems } = this.state;
    if (!gridItems[colIdx] || !gridItems[colIdx][iIdx]) {
      return [];
    }
    const itemA = gridItems[colIdx][iIdx];
    let allItems = [];
    gridItems.forEach((column, otherColIdx) => {
      column.forEach((itemB, otherItemIdx) => {
        if (itemB.top < itemA.top - 20 || (colIdx === otherColIdx && iIdx === otherItemIdx)) {
          return;
        }
        allItems.push({
          distance: this.calculateDistance(itemA, itemB),
          columnIdx: otherColIdx,
          itemIdx: otherItemIdx,
        });
      });
    });

    // group these by column, insert by the lowest idx in the column
    allItems = allItems.sort((a, b) => a.distance - b.distance);

    const columnToItemMapping = {};
    for (let i = 0; i < noItems; i += 1) {
      if (!allItems[i]) {
        break;
      }
      const { columnIdx, itemIdx } = allItems[i];
      if (!columnToItemMapping[columnIdx]) {
        columnToItemMapping[columnIdx] = {
          itemIdx,
          count: 1,
        };
      } else {
        columnToItemMapping[columnIdx].count += 1;
      }
    }

    return Object.keys(columnToItemMapping).map(column => ({
      columnIdx: column,
      ...columnToItemMapping[column],
    }));
  }

  /**
   * Returns the scroll position of the scroll container.
   */
  getScrollPos() {
    // Try accessing scrollY, as the grid will generally be scrolled by the window.
    const el = this.props.scrollContainer;
    return el.scrollY !== undefined ? el.scrollY : el.scrollTop;
  }

  calculateDistance(A:GridItemType<*>, B:GridItemType<*>) {
    const width = this.props.columnWidth;
    const gutterWidth = this.props.gutterWidth;
    if (A.column === B.column) {
      return A.top < B.top ?
        B.top - (A.bottom + gutterWidth) - 1 :
        A.top - (B.bottom + gutterWidth) - 1;
    }
    if (A.top === B.top) {
      return A.left < B.left ?
        B.left - (A.left + width) - 1 :
        A.left - (B.left + width) - 1;
    }
    if (A.top < B.top) {
      return A.left < B.left ?
        distance({ x: A.bottom, y: A.left + width }, { x: B.top, y: B.left }) :
        distance({ x: A.bottom, y: A.left }, { x: B.top, y: B.left + width });
    }
    return A.left < B.left ?
      distance({ x: A.top, y: A.left + width }, { x: B.bottom, y: B.left }) :
      distance({ x: A.top, y: A.left }, { x: B.bottom, y: B.left + width });
  }

  boundResizeHandler: () => void;
  fetchingWith: bool | number;
  gridWrapper: HTMLElement;
  insertedItemsCount: number;
  itemKeyCounter: number;
  resizeTimeout: ?number;
  scrollBuffer: number;

  updateItems(items: Array<*>) {
    if (!items) {
      return;
    }
    if (items.length !== this.insertedItemsCount) {
      this.insertItems(items.slice(this.insertedItemsCount));
      this.insertedItemsCount = items.length;
    }
  }

  handleAddRelatedItems(itemInfo: GridItemType<T>) {
    return (items: Array<GridItemType<T>>) => {
      const itemIndex = this.state.gridItems[itemInfo.column].indexOf(itemInfo);
      const relatedItems = this.getItemsRelatedTo(itemInfo.column, itemIndex, items.length);
      relatedItems.forEach(({ columnIdx, itemIdx, count }) => {
        this.insertItems(items.splice(0, count), columnIdx, itemIdx);
      });
    };
  }

  insertItems(items: Array<*>, colIdx?: (number | null) = null, itemIdx?: (number | null) = null) {
    // Append a temporary node to the dom to measure it.
    const measuringNode = document.createElement('div');
    document.body.appendChild(measuringNode);

    const gridItems = this.state.gridItems;

    if (!gridItems.length) {
      const columnCount = this.calculateColumns();
      for (let i = 0; i < columnCount; i += 1) {
        gridItems.push([]);
      }
    }

    this.itemKeyCounter = this.itemKeyCounter || 0;

    items.forEach((itemData, insertedItemIdx) => {
      const itemInfo = {};
      const component = (
        <this.props.comp
          data={itemData}
          addRelatedItems={this.handleAddRelatedItems(itemInfo)}
        />
      );
      ReactDOM.unstable_renderSubtreeIntoContainer(
          this, component, measuringNode);

      const { clientWidth, clientHeight } = measuringNode;

      itemInfo.component = component;
      itemInfo.width = clientWidth;
      itemInfo.height = clientHeight;
      itemInfo.itemData = itemData;

      if (colIdx != null && itemIdx != null) {
        if (!gridItems[colIdx]) {
          return;
        }
        const left = (colIdx * this.props.columnWidth) + (this.props.gutterWidth * colIdx);
        const previousItemInColumn = gridItems[colIdx] && gridItems[colIdx][itemIdx - 1] ?
          gridItems[colIdx][itemIdx - 1].bottom : 0;
        const top = previousItemInColumn || 0;

        // Construct a more specific render key for inserted items.
        // This allows us to properly order items after a reflow when sorting on the key.
        const key = parseFloat(`${insertedItemIdx.toString()}.${this.itemKeyCounter}1`);

        itemInfo.column = parseInt(colIdx, 10);
        itemInfo.left = left;
        itemInfo.top = top;
        itemInfo.bottom = top + clientHeight + this.props.gutterWidth;
        itemInfo.key = key;

        gridItems[colIdx].splice(itemIdx, 0, itemInfo);

        // Increase top values of other items
        for (let i = itemIdx + 1; i < gridItems[colIdx].length; i += 1) {
          const gridItem = gridItems[colIdx][i];
          gridItem.top = gridItems[colIdx][i - 1].bottom;
          gridItem.bottom = gridItem.top + gridItem.height + this.props.gutterWidth;
        }
      } else {
        const column = this.shortestColumn();

        const lastItemInColumn = gridItems[column][gridItems[column].length - 1];
        const top = (lastItemInColumn && lastItemInColumn.bottom) || 0;
        const left = (column * this.props.columnWidth) + (this.props.gutterWidth * column);

        itemInfo.column = column;
        itemInfo.appended = true;
        itemInfo.left = left;
        itemInfo.top = top;
        itemInfo.bottom = top + clientHeight + this.props.gutterWidth;
        itemInfo.key = String(this.itemKeyCounter);

        gridItems[column].push(itemInfo);
      }

      this.itemKeyCounter += 1;

      ReactDOM.unmountComponentAtNode(measuringNode);
    });
    document.body.removeChild(measuringNode);

    // The grid height is the longest of all columns.
    let height = 0;
    let minHeight;
    for (let i = 0; i < gridItems.length; i += 1) {
      const column = gridItems[i];
      const lastItem = column[column.length - 1];
      if (lastItem && lastItem.bottom > height) {
        height = lastItem.bottom;
      }
      if (lastItem && (minHeight === undefined || minHeight > lastItem.bottom)) {
        minHeight = lastItem.bottom;
      }
    }

    this.setState({
      gridItems,
      height,
      minHeight: minHeight || this.state.minHeight,
    });
  }

  /**
   * Delays resize handling in case the scroll container is still being resized.
   */
  handleResize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    this.resizeTimeout = setTimeout(this.reflow.bind(this), 100);
  }

  /**
   * Determines the number of columns to display.
   */
  calculateColumns() {
    if (!this.props.scrollContainer) {
      return 0;
    }

    const eachItemWidth = this.props.columnWidth + this.props.gutterWidth;
    /* eslint react/no-find-dom-node: 0 */
    const parentNode = ReactDOM.findDOMNode(this).parentNode;
    const parentWidth = parentNode.clientWidth;

    let newColCount = Math.floor(parentWidth / eachItemWidth);

    if (newColCount < this.props.minCols) {
      newColCount = this.props.minCols;
    }
    return newColCount;
  }

  /**
   * Reflows items if needed after a resize.
   * We need to reflow items if the number of columns we would display should change.
   */
  reflow() {
    const newColCount = this.calculateColumns();
    if (newColCount !== this.state.gridItems.length) {
      const items = this.allItems().sort((a, b) => a.key - b.key).map(item => item.itemData);
      this.itemKeyCounter = 0;
      this.setState({
        gridItems: [],
      }, () => {
        this.insertItems(items);
      });
      return true;
    }
    return false;
  }

  /**
   * Fetches additional items if needed.
   */
  handleScroll = () => {
    // Only load items if props.loadItems is defined.
    if (!this.props.loadItems) {
      return;
    }

    if (this.getScrollPos() + this.scrollBuffer > this.state.minHeight) {
      this.fetchingWith = this.state.gridItems.length;
      this.props.loadItems({ from: this.insertedItemsCount });
    }
  }

  /**
   * # of columns * total item width - 1 item margin
   */
  determineWidth() {
    const eachItemWidth = this.props.columnWidth + this.props.gutterWidth;
    return `${(this.state.gridItems.length * eachItemWidth) - this.props.gutterWidth}px`;
  }

  /**
   * Returns the index of the shortest column.
   */
  shortestColumn() {
    let min = 0;
    for (let col = 0; col < this.state.gridItems.length; col += 1) {
      const colItems = this.state.gridItems[col];
      const lastItem = colItems[colItems.length - 1];
      const currMinColItems = this.state.gridItems[min];
      const currMin = currMinColItems[currMinColItems.length - 1];

      // If there is no last item in this column, set it as the min.
      if (!lastItem) {
        min = col;
        return min;
      }

      if (!currMin || lastItem.bottom < currMin.bottom) {
        min = col;
      }
    }
    return min;
  }

  allItems() : Array<GridItemType<T>> {
    const allItems = [];
    if (!this.state.gridItems.length) {
      return [];
    }
    this.state.gridItems.map(column => column.map(item => allItems.push(item)));
    return allItems;
  }

  render() {
    if (this.fetchingWith !== false && this.fetchingWith !== this.state.gridItems.length) {
      this.fetchingWith = false;
    }

    return (
      <div
        className={styles.Grid}
        ref={(ref) => { this.gridWrapper = ref; }}
        style={{ height: this.state.height, width: this.determineWidth() }}
      >
        {this.allItems().map(item =>
          <div
            className={styles.Grid__Item}
            key={item.key}
            style={{ top: 0, left: 0, transform: `translateX(${item.left}px) translateY(${item.top}px)` }}
          >
            <div className={item.appended ? null : styles.Grid__Item__Animated}>
              {item.component}
            </div>
          </div>,
        )}
      </div>
    );
  }
}

TenzingGrid.propTypes = {
  /**
   * The width of each column.
   */
  columnWidth: React.PropTypes.number,

  /**
   * The component to render.
   */
  /* eslint react/no-unused-prop-types: 0 */
  comp: React.PropTypes.func.isRequired,

  /**
   * The amount of space between each item.
   */
  gutterWidth: React.PropTypes.number,

  /**
   * An array of all objects to display in the grid.
   */
  items: React.PropTypes.arrayOf(React.PropTypes.shape({})).isRequired,

  /**
   * A callback which the grid calls when we need to load more items as the user scrolls.
   * The callback should update the state of the items, and pass those in as props
   * to this component.
   */
  loadItems: React.PropTypes.func,

  /**
   * Minimum number of columns to display.
   */
  minCols: React.PropTypes.number,

  /**
   * The scroll container to use. Defaults to window.
   */
  scrollContainer: React.PropTypes.shape({
    addEventListener: React.PropTypes.func,
    removeEventListener: React.PropTypes.func,
  }),
};

TenzingGrid.defaultProps = {
  columnWidth: 236,
  gutterWidth: 14,
  minCols: 3,
  scrollContainer: typeof window !== 'undefined' ? window : null,
  loadItems: () => {},
};
