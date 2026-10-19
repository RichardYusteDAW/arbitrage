import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOpportunities } from '../src/03-domain/helpers/calculations.js';
import { ticker } from './fixtures.js';

const assertClose = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, actual + ' != ' + expected);

const inputs = (buy = {}, sell = {}, conversions = [ticker()]) => ({
    buyer: [ticker({ symbol: 'ETHBTC', askPrice: 10, bidPrice: 9, ...buy }), ...conversions],
    seller: [ticker({ symbol: 'ETHBTC', askPrice: 12, bidPrice: 11, ...sell })]
});

test('descarta margenes que no cubren el 0,1% de compra y el 0,1% de venta', () => {
    assert.deepEqual(calculateOpportunities(inputs({ askPrice: 100 }, { bidPrice: 100.2 })), []);
});

test('deja de consumir el libro cuando el siguiente nivel pierde dinero tras comisiones', () => {
    const [result] = calculateOpportunities({
        buyer: [ticker({ asks: [[100, 1], [100.9, 10]] })],
        seller: [ticker({ bids: [[101, 20]] })]
    });
    assert.equal(result.quantity, 1);
    assertClose(result.maxVolumeUSD, 100.1);
    assertClose(result.profitUSD, 0.799);
    assertClose(result.profitability, 0.799 / 100.1 * 100);
});

test('calcula rentabilidad, volumen y beneficio sin redondear los datos internos', () => {
    const [result] = calculateOpportunities(inputs({ askPrice: '10', askQty: '2' }, { bidQty: '0.5' }));
    assert.equal(result.symbol, 'ETHBTC');
    assert.equal(result.buy, 'buyer');
    assert.equal(result.sell, 'seller');
    assert.equal(result.quantity, 0.5);
    assertClose(result.maxVolumeUSD, 50.05);
    assertClose(result.profitUSD, 4.895);
    assertClose(result.profitability, 4.895 / 50.05 * 100);
});

test('comprueba ambos sentidos y usa el precio USD del exchange de compra', () => {
    const data = inputs({ askPrice: 12, bidPrice: 11 }, { askPrice: 10, bidPrice: 9 });
    data.seller.push(ticker({ askPrice: 150 }));
    const [result] = calculateOpportunities(data);
    assert.equal(result.buy, 'seller');
    assert.equal(result.sell, 'buyer');
    assertClose(result.maxVolumeUSD, 150 * 1.001);
    assertClose(result.profitUSD, 14.685);
});

test('compara tres exchanges sin compararlos consigo mismos', () => {
    const data = { a: [ticker({ askPrice: 10, bidPrice: 9 })],
        b: [ticker({ askPrice: 12, bidPrice: 11 })], c: [ticker({ askPrice: 8, bidPrice: 7 })] };
    assert.deepEqual(calculateOpportunities(data).map(o => `${o.buy}->${o.sell}`).sort(), ['a->b', 'c->a', 'c->b']);
    assert.deepEqual(calculateOpportunities({ a: data.a }), []);
    assert.deepEqual(calculateOpportunities({}), []);
});

test('descarta símbolos desconocidos, diferentes y rentabilidades no positivas', () => {
    assert.deepEqual(calculateOpportunities(inputs({}, { bidPrice: 10 })), []);
    assert.deepEqual(calculateOpportunities(inputs({}, { bidPrice: 9 })), []);
    assert.deepEqual(calculateOpportunities({ a: [ticker()], b: [ticker({ symbol: 'BTCUSDT' })] }), []);
    assert.deepEqual(calculateOpportunities({ a: [ticker({ symbol: undefined })], b: [ticker({ symbol: undefined })] }), []);
});

for (const invalid of [0, -1, NaN, Infinity, -Infinity, undefined, 'invalid']) {
    test(`rechaza precios inválidos: ${String(invalid)}`, () => {
        assert.deepEqual(calculateOpportunities(inputs({ askPrice: invalid })), []);
        assert.deepEqual(calculateOpportunities(inputs({}, { bidPrice: invalid })), []);
    });
}

test('USDT tiene prioridad sobre USDC independientemente del orden de entrada', () => {
    const data = inputs({}, {}, [ticker({ symbol: 'ETHUSDC', askPrice: 200 }), ticker({ askPrice: 100 })]);
    assertClose(calculateOpportunities(data)[0].maxVolumeUSD, 100 * 1.001);
});

test('utiliza USDC si faltan USD y USDT y devuelve null sin ninguna conversi?n', () => {
    assertClose(calculateOpportunities(inputs({}, {}, [ticker({ symbol: 'ETHUSDC', askPrice: 200 })]))[0].maxVolumeUSD, 200 * 1.001);
    const [result] = calculateOpportunities(inputs({}, {}, []));
    assert.equal(result.maxVolumeUSD, null);
    assert.equal(result.profitUSD, null);
});

for (const invalid of [0, -1, NaN, Infinity, 'invalid']) {
    test(`un precio USDT inválido devuelve null sin recurrir a USDC: ${String(invalid)}`, () => {
        const data = inputs({}, {}, [ticker({ askPrice: invalid }), ticker({ symbol: 'ETHUSDC', askPrice: 200 })]);
        assert.equal(calculateOpportunities(data)[0].maxVolumeUSD, null);
        assert.equal(calculateOpportunities(data)[0].profitUSD, null);
    });
}

for (const invalid of [0, -1, NaN, undefined, null]) {
    test(`una cantidad inválida impide estimar volumen y beneficio: ${String(invalid)}`, () => {
        const [result] = calculateOpportunities(inputs({ askQty: invalid }));
        assert.equal(result.maxVolumeUSD, null);
        assert.equal(result.profitUSD, null);
    });
}

test('descarta un mínimo infinito y obtiene baseAsset del otro exchange si hace falta', () => {
    assert.equal(calculateOpportunities(inputs({ askQty: Infinity }, { bidQty: Infinity }))[0].maxVolumeUSD, null);
    assertClose(calculateOpportunities(inputs({ baseAsset: undefined }))[0].maxVolumeUSD, 100 * 1.001);
});

test('no modifica el objeto ni los arrays de entrada', () => {
    const data = inputs();
    const before = structuredClone(data);
    calculateOpportunities(data);
    assert.deepEqual(structuredClone(data), before);
});


test('USD tiene prioridad sobre USDT y USDC independientemente del orden de entrada', () => {
    const conversions = [ticker({ symbol: 'ETHUSDC', askPrice: 200 }),
        ticker({ askPrice: 100 }), ticker({ symbol: 'ETHUSD', askPrice: 150 })];
    for (const ordered of [conversions, [...conversions].reverse()]) {
        const [result] = calculateOpportunities(inputs({}, {}, ordered));
        assertClose(result.maxVolumeUSD, 150 * 1.001);
        assertClose(result.profitUSD, 14.685);
    }
});

test('un par cotizado en USD permite calcular su volumen sin USDT ni USDC', () => {
    const [result] = calculateOpportunities(inputs({ symbol: 'ETHUSD' }, { symbol: 'ETHUSD' }, []));
    assertClose(result.maxVolumeUSD, 10 * 1.001);
    assertClose(result.profitUSD, 0.979);
});

test('si el par USD existe con precio inv?lido devuelve null como las otras conversiones', () => {
    const [result] = calculateOpportunities(inputs({}, {}, [ticker({ symbol: 'ETHUSD', askPrice: 0 }), ticker()]));
    assert.equal(result.maxVolumeUSD, null);
    assert.equal(result.profitUSD, null);
});

test('recorre ambos libros, agota niveles y se detiene antes del margen negativo', () => {
    const data = {
        buyer: [ticker({ asks: [[110, 10], [100, 2], [101, 3]] })],
        seller: [ticker({ bids: [[99, 10], [104, 2], [102, 4], [105, 1]] })]
    };
    const before = structuredClone(data);
    const result = calculateOpportunities(data).find(item => item.buy === 'buyer');
    assert.equal(result.quantity, 5);
    assertClose(result.maxVolumeUSD, 503 * 1.001);
    assertClose(result.profitUSD, 12.98);
    assertClose(result.profitability, 12.98 / 503.503 * 100);
    assert.deepEqual(structuredClone(data), before);
});

test('el volumen usa el coste real de todos los niveles y la rentabilidad sus precios medios', () => {
    const [result] = calculateOpportunities({
        buyer: [ticker({ asks: [[100, 2], [110, 3]] })],
        seller: [ticker({ bids: [[120, 5]] })]
    });
    assert.equal(result.quantity, 5);
    assertClose(result.maxVolumeUSD, 530 * 1.001);
    assertClose(result.profitUSD, 68.87);
    assertClose(result.profitability, 68.87 / 530.53 * 100);
});

test('la cantidad queda limitada por el lado con menos liquidez rentable', () => {
    const [result] = calculateOpportunities({
        buyer: [ticker({ asks: [[100, 10]] })],
        seller: [ticker({ bids: [[110, 1], [105, 2], [100, 20]] })]
    });
    assert.equal(result.quantity, 3);
    assertClose(result.maxVolumeUSD, 300 * 1.001);
    assertClose(result.profitUSD, 19.38);
});

test('la cantidad se calcula en EUR aunque falte la conversion a dolares', () => {
    const data = {
        buyer: [ticker({ symbol: 'ETHEUR', asks: [[100, 2], [110, 3]] })],
        seller: [ticker({ symbol: 'ETHEUR', bids: [[120, 5]] })]
    };
    const [withoutConversion] = calculateOpportunities(data);
    assert.equal(withoutConversion.quantity, 5);
    assert.equal(withoutConversion.maxVolumeUSD, null);
    assert.equal(withoutConversion.profitUSD, null);
    data.buyer.push(ticker({ symbol: 'EURUSD', baseAsset: 'EUR', askPrice: 1.1, bidPrice: 1.09 }));
    const [converted] = calculateOpportunities(data);
    assert.ok(Math.abs(converted.maxVolumeUSD - 583.583) < 1e-10);
    assert.ok(Math.abs(converted.profitUSD - 75.757) < 1e-10);
});
