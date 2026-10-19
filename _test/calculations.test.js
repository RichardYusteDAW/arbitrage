import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateOpportunities } from '../src/03-domain/helpers/calculations.js';
import { ticker } from './fixtures.js';
import { Opportunity } from '../src/03-domain/models/opportunity.js';

const inputs = (buy = {}, sell = {}, conversions = [ticker()]) => ({
    buyer: [ticker({ symbol: 'ETHBTC', askPrice: 10, bidPrice: 9, ...buy }), ...conversions],
    seller: [ticker({ symbol: 'ETHBTC', askPrice: 12, bidPrice: 11, ...sell })]
});

test('calcula rentabilidad, volumen y beneficio sin redondear los datos internos', () => {
    const [result] = calculateOpportunities(inputs({ askPrice: '10', askQty: '2' }, { bidQty: '0.5' }));
    assert.deepEqual(result, new Opportunity({ symbol: 'ETHBTC', buy: 'buyer', sell: 'seller', profitability: 10, quantity: 0.5, maxVolumeUSD: 50, profitUSD: 5 }));
});

test('comprueba ambos sentidos y usa el precio USD del exchange de compra', () => {
    const data = inputs({ askPrice: 12, bidPrice: 11 }, { askPrice: 10, bidPrice: 9 });
    data.seller.push(ticker({ askPrice: 150 }));
    const [result] = calculateOpportunities(data);
    assert.equal(result.buy, 'seller');
    assert.equal(result.sell, 'buyer');
    assert.equal(result.maxVolumeUSD, 150);
    assert.equal(result.profitUSD, 15);
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
    assert.equal(calculateOpportunities(data)[0].maxVolumeUSD, 100);
});

test('utiliza USDC si faltan USD y USDT y devuelve null sin ninguna conversi?n', () => {
    assert.equal(calculateOpportunities(inputs({}, {}, [ticker({ symbol: 'ETHUSDC', askPrice: 200 })]))[0].maxVolumeUSD, 200);
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
    assert.equal(calculateOpportunities(inputs({ baseAsset: undefined }))[0].maxVolumeUSD, 100);
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
        assert.equal(result.maxVolumeUSD, 150);
        assert.equal(result.profitUSD, 15);
    }
});

test('un par cotizado en USD permite calcular su volumen sin USDT ni USDC', () => {
    const [result] = calculateOpportunities(inputs({ symbol: 'ETHUSD' }, { symbol: 'ETHUSD' }, []));
    assert.equal(result.maxVolumeUSD, 10);
    assert.equal(result.profitUSD, 1);
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
    assert.equal(result.maxVolumeUSD, 503);
    assert.equal(result.profitUSD, 14);
    assert.equal(result.profitability, 14 / 503 * 100);
    assert.deepEqual(structuredClone(data), before);
});

test('el volumen usa el coste real de todos los niveles y la rentabilidad sus precios medios', () => {
    const [result] = calculateOpportunities({
        buyer: [ticker({ asks: [[100, 2], [110, 3]] })],
        seller: [ticker({ bids: [[120, 5]] })]
    });
    assert.equal(result.quantity, 5);
    assert.equal(result.maxVolumeUSD, 530);
    assert.equal(result.profitUSD, 70);
    assert.equal(result.profitability, 70 / 530 * 100);
});

test('la cantidad queda limitada por el lado con menos liquidez rentable', () => {
    const [result] = calculateOpportunities({
        buyer: [ticker({ asks: [[100, 10]] })],
        seller: [ticker({ bids: [[110, 1], [105, 2], [100, 20]] })]
    });
    assert.equal(result.quantity, 3);
    assert.equal(result.maxVolumeUSD, 300);
    assert.equal(result.profitUSD, 20);
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
    assert.ok(Math.abs(converted.maxVolumeUSD - 583) < 1e-10);
    assert.ok(Math.abs(converted.profitUSD - 77) < 1e-10);
});
