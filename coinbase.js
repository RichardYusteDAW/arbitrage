
const isTradableProduct = product =>
            product.product_type === 'SPOT' &&
            product.status === 'online' &&
            !product.trading_disabled &&
            !product.is_disabled &&
            !product.view_only &&
            !product.cancel_only &&
            !product.limit_only &&
            !product.post_only;

const loadCoinbaseData = async (url, request) => {
    const products = [];
    const cursors = new Set();
    let nextUrl = url;

    while (nextUrl) {
        const data = await request(nextUrl);
        products.push(...data.products);
        nextUrl = null;

        if (data.pagination?.has_next) {
            const cursor = data.pagination.next_cursor;
            if (!cursor || cursors.has(cursor))
                throw new Error('coinbase: invalid pagination cursor');

            cursors.add(cursor);
            const pageUrl = new URL(url);
            pageUrl.searchParams.set('cursor', cursor);
            nextUrl = pageUrl.toString();
        }
    }

    const activeProducts = products.filter(isTradableProduct);
    let nextIndex = 0;

    // Fetch books with limited concurrency.
    await Promise.all(Array.from({ length: 3 }, async () => {
        while (nextIndex < activeProducts.length) {
            const product = activeProducts[nextIndex++];
            const bookUrl = new URL('https://api.coinbase.com/api/v3/brokerage/market/product_book');
            bookUrl.searchParams.set('product_id', product.product_id);
            bookUrl.searchParams.set('limit', '1');

            let data;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    data = await request(bookUrl.toString());
                    break;
                } catch (error) {
                    if (error.status !== 429 || attempt === 2) throw error;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            product.pricebook = data.pricebook;
        }
    }));

    return activeProducts;
};

const getCoinbaseData = products => {
    return products
        .filter(isTradableProduct)
        .filter(product => product.pricebook?.bids?.length && product.pricebook?.asks?.length)
        .map(product => ({
            symbol: product.base_currency_id + product.quote_currency_id,
            baseAsset: product.base_currency_id,
            bidPrice: Number(product.pricebook.bids[0].price),
            bidQty: Number(product.pricebook.bids[0].size),
            askPrice: Number(product.pricebook.asks[0].price),
            askQty: Number(product.pricebook.asks[0].size)
        }));
};

export { getCoinbaseData, loadCoinbaseData };