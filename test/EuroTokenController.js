import { expect } from "chai";
import createAccessPolicy from "./helpers/createAccessPolicy";
import { eventValue } from "./helpers/events";
import roles from "./helpers/roles";
import { knownInterfaces } from "./helpers/knownInterfaces";
import { deployUniverse, deployIdentityRegistry } from "./helpers/deployContracts";
import registerSingletons from "./helpers/registerSingletons";
import { Q18, toBytes32 } from "./helpers/constants";

const EuroTokenController = artifacts.require("EuroTokenController");
const minDepositAmountEurUlps = Q18.mul(500);
const minWithdrawAmountEurUlps = Q18.mul(20);
const maxSimpleExchangeAllowanceEurUlps = Q18.mul(50);

contract(
  "EuroTokenController",
  ([_, masterManager, eurtLegalManager, identity1, identity2, nonkycIdentity, explicit]) => {
    let accessControl;
    let universe;
    let identityRegistry;
    let tokenController;

    before(async () => {
      [universe, accessControl] = await deployUniverse(masterManager, masterManager);
      await createAccessPolicy(accessControl, [
        { subject: eurtLegalManager, role: roles.eurtLegalManager },
      ]);
      // singletons recognized internally by token controller
      await registerSingletons(universe, masterManager, [
        {
          ki: knownInterfaces.gasExchange,
          addr: "0x498a042f52f1737a77b91dd8107e68d75bf9f478",
        },
        {
          ki: knownInterfaces.euroToken,
          addr: "0xd102445e80c56d36c7dcd968dc2792b87b236b46",
        },
        {
          ki: knownInterfaces.feeDisbursal,
          addr: "0xc22b7a02afa706b5bc2fdfc305288bd910812977",
        },
        {
          ki: knownInterfaces.euroLock,
          addr: "0x147df49452f805d1a35e7ca314f564d1087b112f",
        },
      ]);
    });

    beforeEach(async () => {});

    async function deployEuroTokenController(
      _minDepositAmountEurUlps,
      _minWithdrawAmountEurUlps,
      _maxSimpleExchangeAllowanceEurUlps,
    ) {
      identityRegistry = await deployIdentityRegistry(universe, masterManager, masterManager);
      // set no limits, block infinite allowance
      tokenController = await EuroTokenController.new(universe.address);
      await tokenController.applySettings(
        _minDepositAmountEurUlps,
        _minWithdrawAmountEurUlps,
        _maxSimpleExchangeAllowanceEurUlps,
        { from: eurtLegalManager },
      );
    }

    // eslint-disable-next-line no-unused-vars
    function expectUniverseReloadedEvent(tx) {
      const event = eventValue(tx, "LogUniverseReloaded");
      expect(event).to.exist;
    }

    // eslint-disable-next-line no-unused-vars
    function expectAllowedToEvent(tx, to, allowed) {
      const event = eventValue(tx, "LogAllowedToAddress");
      expect(event).to.exist;
      expect(event.args.to).to.eq(to);
      expect(event.args.allowed).to.eq(allowed);
    }

    // eslint-disable-next-line no-unused-vars
    function expectAllowedFromEvent(tx, from, allowed) {
      const event = eventValue(tx, "LogAllowedFromAddress");
      expect(event).to.exist;
      expect(event.args.from).to.eq(from);
      expect(event.args.allowed).to.eq(allowed);
    }

    describe("general tests", () => {
      before(async () => {});

      beforeEach(async () => {
        await deployEuroTokenController(
          minDepositAmountEurUlps,
          minWithdrawAmountEurUlps,
          maxSimpleExchangeAllowanceEurUlps,
        );
      });

      it("should deploy", async () => {
        // const depTx = await promisify(web3.eth.getTransactionReceipt)(
        //   tokenController.transactionHash,
        // );
        // expectUniverseReloadedEvent(depTx);
        /* const fromEvents = tx.logs.filter(e => e.event === "LogAllowedFromAddress");
        expect(fromEvents.length).to.eq(2);
        const toEvents = tx.logs.filter(e => e.event === "LogAllowedToAddress");
        expect(toEvents.length).to.eq(2); */
        // parameters should be set
        expect(await tokenController.minDepositAmountEurUlps()).to.be.bignumber.eq(
          minDepositAmountEurUlps,
        );
        expect(await tokenController.minWithdrawAmountEurUlps()).to.be.bignumber.eq(
          minWithdrawAmountEurUlps,
        );
        expect(await tokenController.maxSimpleExchangeAllowanceEurUlps()).to.be.bignumber.eq(
          maxSimpleExchangeAllowanceEurUlps,
        );
        // several contracts should be whitelisted for transfers
        expect(await tokenController.allowedTransferFrom(await universe.gasExchange())).to.be.true;
        expect(await tokenController.allowedTransferTo(await universe.gasExchange())).to.be.true;
        expect(await tokenController.allowedTransferFrom(await universe.feeDisbursal())).to.be.true;
        expect(await tokenController.allowedTransferTo(await universe.feeDisbursal())).to.be.true;
        expect(await tokenController.allowedTransferFrom(await universe.euroLock())).to.be.true;
        expect(await tokenController.allowedTransferTo(await universe.euroLock())).to.be.true;
        // euro token cannot receive transfers
        expect(await tokenController.allowedTransferFrom(await universe.euroToken())).to.be.false;
        expect(await tokenController.allowedTransferTo(await universe.euroToken())).to.be.false;
      });

      it("should set allow from", async () => {
        expect(await tokenController.allowedTransferFrom(identity1)).to.be.false;
        await tokenController.setAllowedTransferFrom(identity1, true, { from: eurtLegalManager });
        expect(await tokenController.allowedTransferFrom(identity1)).to.be.true;
        expect(await tokenController.allowedTransferFrom(identity2)).to.be.false;
        await tokenController.setAllowedTransferFrom(identity1, false, { from: eurtLegalManager });
        expect(await tokenController.allowedTransferFrom(identity1)).to.be.false;
      });

      it("should set allow to", async () => {
        expect(await tokenController.allowedTransferTo(identity1)).to.be.false;
        await tokenController.setAllowedTransferTo(identity1, true, { from: eurtLegalManager });
        expect(await tokenController.allowedTransferTo(identity1)).to.be.true;
        expect(await tokenController.allowedTransferTo(identity2)).to.be.false;
        await tokenController.setAllowedTransferTo(identity1, false, { from: eurtLegalManager });
        expect(await tokenController.allowedTransferTo(identity1)).to.be.false;
      });

      it("should apply settings", async () => {
        tokenController.applySettings(Q18.mul(10), Q18.mul(20), Q18.mul(30), {
          from: eurtLegalManager,
        });
        expect(await tokenController.minDepositAmountEurUlps()).to.be.bignumber.eq(Q18.mul(10));
        expect(await tokenController.minWithdrawAmountEurUlps()).to.be.bignumber.eq(Q18.mul(20));
        expect(await tokenController.maxSimpleExchangeAllowanceEurUlps()).to.be.bignumber.eq(
          Q18.mul(30),
        );

        tokenController.applySettings(Q18.mul(40), Q18.mul(50), Q18.mul(60), {
          from: eurtLegalManager,
        });
        expect(await tokenController.minDepositAmountEurUlps()).to.be.bignumber.eq(Q18.mul(40));
        expect(await tokenController.minWithdrawAmountEurUlps()).to.be.bignumber.eq(Q18.mul(50));
        expect(await tokenController.maxSimpleExchangeAllowanceEurUlps()).to.be.bignumber.eq(
          Q18.mul(60),
        );
      });

      it("should apply allowances from universe", async () => {
        const newGasExchange = "0x498a042f52f1737a77b91dd8107e68d75bf9ffff";
        const newFeedisbursal = "0x498a042f52f1737a77b91dd8107e68d75bf9eeee";
        const newEuroLock = "0x498a042f52f1737a77b91dd8107e68d75bf9dddd";

        expect(await tokenController.allowedTransferTo(newGasExchange)).to.be.false;
        expect(await tokenController.allowedTransferTo(newFeedisbursal)).to.be.false;
        expect(await tokenController.allowedTransferTo(newEuroLock)).to.be.false;
        expect(await tokenController.allowedTransferFrom(newGasExchange)).to.be.false;
        expect(await tokenController.allowedTransferFrom(newFeedisbursal)).to.be.false;
        expect(await tokenController.allowedTransferFrom(newEuroLock)).to.be.false;

        await registerSingletons(universe, masterManager, [
          {
            ki: knownInterfaces.gasExchange,
            addr: newGasExchange,
          },
          {
            ki: knownInterfaces.feeDisbursal,
            addr: newFeedisbursal,
          },
          {
            ki: knownInterfaces.euroLock,
            addr: newEuroLock,
          },
        ]);

        tokenController.applySettings(Q18.mul(10), Q18.mul(20), Q18.mul(30), {
          from: eurtLegalManager,
        });

        expect(await tokenController.allowedTransferTo(newGasExchange)).to.be.true;
        expect(await tokenController.allowedTransferTo(newFeedisbursal)).to.be.true;
        expect(await tokenController.allowedTransferTo(newEuroLock)).to.be.true;
        expect(await tokenController.allowedTransferFrom(newGasExchange)).to.be.true;
        expect(await tokenController.allowedTransferFrom(newFeedisbursal)).to.be.true;
        expect(await tokenController.allowedTransferFrom(newEuroLock)).to.be.true;
      });

      it("should apply settings when gas exchange address changes", async () => {
        const newGasExchange = "0x498a042f52f1737a77b91dd8107e68d75bf90000";
        const oldGasExchange = await universe.gasExchange();
        expect(
          await tokenController.hasPermanentAllowance(
            oldGasExchange,
            maxSimpleExchangeAllowanceEurUlps,
          ),
        ).to.be.true;
        expect(
          await tokenController.hasPermanentAllowance(
            newGasExchange,
            maxSimpleExchangeAllowanceEurUlps,
          ),
        ).to.be.false;
        // singletons recognized internally by token controller
        await registerSingletons(universe, masterManager, [
          {
            ki: knownInterfaces.gasExchange,
            addr: newGasExchange,
          },
        ]);
        expect(
          await tokenController.hasPermanentAllowance(
            oldGasExchange,
            maxSimpleExchangeAllowanceEurUlps,
          ),
        ).to.be.false;
        expect(
          await tokenController.hasPermanentAllowance(
            newGasExchange,
            maxSimpleExchangeAllowanceEurUlps,
          ),
        ).to.be.true;
      });

      // set allowed from. allowed to, apply settings
      it("should reject on admin ops not from manager", async () => {
        const amount = 1;

        await expect(
          tokenController.setAllowedTransferFrom(identity1, true, {
            from: identity1,
          }),
        ).to.revert;

        await expect(
          tokenController.setAllowedTransferTo(identity2, true, {
            from: identity1,
          }),
        ).to.revert;

        await expect(tokenController.applySettings(amount, amount, amount, { from: identity1 })).to
          .revert;
      });

      it("should liquidate account via eurt legal rep");
    });

    describe("ITokenController tests", () => {
      before(async () => {});

      beforeEach(async () => {
        await deployEuroTokenController(
          minDepositAmountEurUlps,
          minWithdrawAmountEurUlps,
          maxSimpleExchangeAllowanceEurUlps,
        );
      });

      it("should allow/disallow transfer with explicit permissions", async () => {
        // when to and from explicitely permitted
        await tokenController.setAllowedTransferFrom(identity1, true, {
          from: eurtLegalManager,
        });
        await tokenController.setAllowedTransferTo(identity2, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.true;
        // direction matters: [to] -> [from] disallowed
        expect(await tokenController.onTransfer(identity2, identity1, 0)).to.be.false;
        // drop from
        await tokenController.setAllowedTransferFrom(identity1, false, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.false;
        // add from
        await tokenController.setAllowedTransferFrom(identity1, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.true;
        // drop to
        await tokenController.setAllowedTransferTo(identity2, false, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.false;
        // drop all
        await tokenController.setAllowedTransferFrom(identity1, false, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.false;

        // when kyc identity to ETO
      });

      it("should allow/disallow transfer with KYC", async () => {
        const isVerified = toBytes32("0x1");
        await tokenController.setAllowedTransferTo(explicit, true, {
          from: eurtLegalManager,
        });
        const explicitTo = explicit;
        const explicitFrom = await universe.gasExchange();
        await identityRegistry.setMultipleClaims(
          [identity1, identity2],
          ["0x0", "0x0"],
          [isVerified, isVerified],
          { from: masterManager },
        );
        // when kyc identity to explicit
        expect(await tokenController.onTransfer(identity1, explicitTo, 0)).to.be.true;
        // disallow non kyc to explicit
        expect(await tokenController.onTransfer(nonkycIdentity, explicitTo, 0)).to.be.false;
        // disallow kyc to kyc
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.false;
        // when kyc to not allowed identity
        expect(await tokenController.onTransfer(identity1, nonkycIdentity, 0)).to.be.false;
        // when kyc to not allowed contract
        expect(await tokenController.onTransfer(identity1, universe.address, 0)).to.be.false;
        // non kyc to non kyc
        expect(await tokenController.onTransfer(nonkycIdentity, universe.address, 0)).to.be.false;
        // explicit from to kyc is allowed (disbursal)
        expect(await tokenController.onTransfer(explicitFrom, identity1, 0)).to.be.true;
        // explicit from to non kyc is blocked
        expect(await tokenController.onTransfer(explicitFrom, nonkycIdentity, 0)).to.be.false;
        // disallow kyc to kyc via broker without transferFrom
        expect(await tokenController.onTransferFrom(explicitTo, identity1, identity2, 0)).to.be
          .false;
        // allow kyc to kyc via broker
        expect(await tokenController.onTransferFrom(explicitFrom, identity1, identity2, 0)).to.be
          .true;
        // disallow kyc to kyc via kyc
        expect(await tokenController.onTransferFrom(identity1, identity1, identity2, 0)).to.be
          .false;
        // freeze account to disallow
        await identityRegistry.setClaims(identity1, toBytes32("0x1"), toBytes32("0xe"), {
          from: masterManager,
        });
        // frozen to explicit blocked
        expect(await tokenController.onTransfer(identity1, explicitTo, 0)).to.be.false;
        // explicit to frozen blocked
        expect(await tokenController.onTransfer(explicitFrom, identity1, 0)).to.be.false;
        // frozen to kyc blocked
        expect(await tokenController.onTransfer(identity1, identity2, 0)).to.be.false;
      });

      async function transferPermissionsWithInterfaces(knownInterface) {
        const isVerified = toBytes32("0x1");
        const etoAddress = _;
        await universe.setCollectionInterface(knownInterface, etoAddress, true, {
          from: masterManager,
        });
        await tokenController.setAllowedTransferTo(explicit, true, {
          from: eurtLegalManager,
        });
        const explicitTo = explicit;
        const explicitFrom = await universe.gasExchange();
        await identityRegistry.setMultipleClaims(
          [identity1, identity2],
          ["0x0", "0x0"],
          [isVerified, isVerified],
          { from: masterManager },
        );
        // kyc to eto is allowed
        expect(await tokenController.onTransfer(identity1, etoAddress, 0)).to.be.true;
        // eto to kyc is allowed
        expect(await tokenController.onTransfer(etoAddress, identity1, 0)).to.be.true;
        // non kyc to eto is disallowed
        expect(await tokenController.onTransfer(nonkycIdentity, etoAddress, 0)).to.be.false;
        // eto to non kyc is disallowed
        expect(await tokenController.onTransfer(etoAddress, nonkycIdentity, 0)).to.be.false;
        // eto to explicit to is allowed (refund to locked account)
        expect(await tokenController.onTransfer(etoAddress, explicitTo, 0)).to.be.true;
        // explicit from to eto is allowed
        expect(await tokenController.onTransfer(explicitFrom, etoAddress, 0)).to.be.true;
        // freeze account to disallow
        await identityRegistry.setClaims(identity1, toBytes32("0x1"), toBytes32("0xe"), {
          from: masterManager,
        });
        expect(await tokenController.onTransfer(identity1, etoAddress, 0)).to.be.false;
        expect(await tokenController.onTransfer(etoAddress, identity1, 0)).to.be.false;
      }

      it("should allow/disallow transfer with ETO", async () => {
        await transferPermissionsWithInterfaces(knownInterfaces.commitmentInterface);
      });

      it("should allow/disallow transfer with EquityTokenController", async () => {
        await transferPermissionsWithInterfaces(knownInterfaces.equityTokenControllerInterface);
      });

      it("should always approve");

      it("should have permanent allowance for gasExchange", async () => {
        const gasExchange = await universe.gasExchange();
        expect(
          await tokenController.hasPermanentAllowance(
            gasExchange,
            maxSimpleExchangeAllowanceEurUlps,
          ),
        ).to.be.true;
        expect(
          await tokenController.hasPermanentAllowance(
            gasExchange,
            maxSimpleExchangeAllowanceEurUlps.divToInt(2),
          ),
        ).to.be.true;
        expect(
          await tokenController.hasPermanentAllowance(
            gasExchange,
            maxSimpleExchangeAllowanceEurUlps.add(1),
          ),
        ).to.be.false;
      });

      it("should not have permanent allowance for other accounts", async () => {
        expect(
          await tokenController.hasPermanentAllowance(identity1, maxSimpleExchangeAllowanceEurUlps),
        ).to.be.false;
      });

      it("should allow deposit for KYC and explicit", async () => {
        await tokenController.setAllowedTransferTo(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onGenerateTokens(_, explicit, minDepositAmountEurUlps)).to.be
          .true;
        await identityRegistry.setClaims(identity1, "0x0", toBytes32("0x1"), {
          from: masterManager,
        });
        expect(await tokenController.onGenerateTokens(_, identity1, minDepositAmountEurUlps)).to.be
          .true;
      });

      it("should disallow deposit below minimum", async () => {
        await tokenController.setAllowedTransferTo(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onGenerateTokens(_, explicit, minDepositAmountEurUlps)).to.be
          .true;
        expect(await tokenController.onGenerateTokens(_, explicit, minDepositAmountEurUlps.add(1)))
          .to.be.true;
        expect(await tokenController.onGenerateTokens(_, explicit, minDepositAmountEurUlps.sub(1)))
          .to.be.false;
      });

      it("should disallow deposit for non KYC/frozen", async () => {
        await identityRegistry.setClaims(identity1, "0x0", toBytes32("0x1"), {
          from: masterManager,
        });
        expect(await tokenController.onGenerateTokens(_, identity1, minDepositAmountEurUlps)).to.be
          .true;
        // freeze account
        await identityRegistry.setClaims(identity1, toBytes32("0x1"), toBytes32("0xe"), {
          from: masterManager,
        });
        expect(await tokenController.onGenerateTokens(_, identity1, minDepositAmountEurUlps)).to.be
          .false;
        // remove verification
        await identityRegistry.setClaims(identity1, toBytes32("0xe"), "0x0", {
          from: masterManager,
        });
        expect(await tokenController.onGenerateTokens(_, identity1, minDepositAmountEurUlps)).to.be
          .false;
        // also check if explicit from disallows
        await tokenController.setAllowedTransferFrom(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onGenerateTokens(_, explicit, minDepositAmountEurUlps)).to.be
          .false;
        // also any address disallowed
        expect(await tokenController.onGenerateTokens(_, nonkycIdentity, minDepositAmountEurUlps))
          .to.be.false;
      });

      it("should allow withdraw for KYC/bank account and explicit", async () => {
        await tokenController.setAllowedTransferFrom(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onDestroyTokens(_, explicit, minWithdrawAmountEurUlps)).to.be
          .true;
        // kyc and bank account required
        await identityRegistry.setClaims(identity1, "0x0", toBytes32("0x5"), {
          from: masterManager,
        });
        expect(await tokenController.onDestroyTokens(_, identity1, minWithdrawAmountEurUlps)).to.be
          .true;
      });

      it("should disallow withdraw if no bank account", async () => {});

      it("should disallow withdraw below minimum", async () => {
        await tokenController.setAllowedTransferFrom(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onDestroyTokens(_, explicit, minWithdrawAmountEurUlps)).to.be
          .true;
        expect(await tokenController.onDestroyTokens(_, explicit, minWithdrawAmountEurUlps.add(1)))
          .to.be.true;
        expect(await tokenController.onDestroyTokens(_, explicit, minWithdrawAmountEurUlps.sub(1)))
          .to.be.false;
      });

      it("should disallow withdraw for non KYC/frozen", async () => {
        await identityRegistry.setClaims(identity1, "0x0", toBytes32("0x5"), {
          from: masterManager,
        });
        expect(await tokenController.onDestroyTokens(_, identity1, minWithdrawAmountEurUlps)).to.be
          .true;
        // freeze account
        await identityRegistry.setClaims(identity1, toBytes32("0x5"), toBytes32("0xe"), {
          from: masterManager,
        });
        expect(await tokenController.onDestroyTokens(_, identity1, minWithdrawAmountEurUlps)).to.be
          .false;
        // remove verification
        await identityRegistry.setClaims(identity1, toBytes32("0xe"), "0x0", {
          from: masterManager,
        });
        expect(await tokenController.onDestroyTokens(_, identity1, minWithdrawAmountEurUlps)).to.be
          .false;
        // also check if explicit to disallows
        await tokenController.setAllowedTransferTo(explicit, true, {
          from: eurtLegalManager,
        });
        expect(await tokenController.onDestroyTokens(_, explicit, minWithdrawAmountEurUlps)).to.be
          .false;
        // also any address disallowed
        expect(await tokenController.onDestroyTokens(_, nonkycIdentity, minWithdrawAmountEurUlps))
          .to.be.false;
      });
    });
  },
);
