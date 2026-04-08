
MEMO 

NanoPPA: Full Technical & Legal Definition 

A nanoPPA is a minimalist, standardized Power Purchase Agreement living as a permissioned token on an EVM blockchain. Think of it as the smallest possible legally-valid energy contract that can be fully automated — a single 15-minute energy trade between a producer and a consumer, validated, settled, and recorded without any human intervention. 

Shape 

1. Parties 

Every nanoPPA token encodes exactly these party slots: 

Role 

Always present? 

Stored fields 

PRODUCER 

✅ Required 

wallet_address, meter_id (EAN/EIC), gps_coords, legal_jurisdiction, entity_type 

CONSUMER 

✅ Required 

same as producer 

AGGREGATOR (Hypha Energy) 

✅ Required 

wallet_address, fee_pct, brp_nominee (bool) 

DSO 

🔶 Conditional (FLEX contracts only) 

wallet_address, dso_id, congestion_oracle_address 

BRP 

🔶 Conditional (if ≠ aggregator) 

wallet_address, brp_eic_code 

OTHER_REC 

🔶 Conditional (REC-to-REC trades) 

wallet_address, rec_registry_id, jurisdiction 

 

Hypha Energy always occupies three roles simultaneously: settlement agent (executes financial settlement on-chain), BRP coordinator (nominates BRP or acts as one), and platform operator (charges a fee). These three roles can be split into separate wallet addresses in future but default to one.[1] 

Shape 

2. Geographic Validation (Corrected National Rules) 

The contract validates distance between producer and consumer GPS coordinates before creation. Validation runs via an oracle that computes Haversine distance and checks against the national rule matrix.[2][3] 

Country 

Rule 

Legal basis 

Key condition 

Spain 

≤5 km (general); ≤500 m (same LV substation) 

RDL 7/2025 (June 2025) 

Was 2 km until June 2025 [2] 

Portugal 

≤2 km (LV); ≤4 km (MV); ≤10 km (HV); ≤20 km (EHV); same substation = no limit 

DL 15/2022 + 2025 amendment 

Voltage-level based, not urban/rural [3] 

Netherlands 

No km limit — nationwide per new Energy Act (2026) 

Dutch Energy Act, adopted Dec 2024 [4] 

Supply licence exemption if: (a) annual supply ≤ annual generation, (b) members-only, (c) ≤ ministerial member count ceiling [1] 

Norway 

Same property OR same C&I zone (≤5 MW PV); residential = same building only 

Revised national budget 2024/2025, eff. July 2025 [5] 

Urban C&I buildings not eligible; no km number in law 

EU default 

Proximity = Member State discretion 

RED II Art. 22 

Falls back to national rule 

 

Validation logic in contract: 

require( 
  distanceOracle.validate( 
    gps_producer, gps_consumer, 
    country_code, voltage_level 
  ) == true, 
  "REC distance rule violated" 
); 
 

Shape 

3. Settlement Interval 

Default: 15 minutes (EU-wide since Jan 2021, Regulation 2017/2195) 

Spain flag: hourly_fallback = true for older smart meter types — 15-minute grid balancing (REE, May 2022) is standard, but some consumer PVPC meters still report hourly[6] 

Physical delivery: sub-second (real-time grid flow, not controllable by contract) 

Financial settlement: always ex-post, computed after the 15-minute interval closes 

Key principle: physical delivery defines financial settlement — no pre-agreed fixed price exists 

Stored fields: interval_minutes (uint8, default 15), hourly_fallback (bool), legal_basis_interval (string). 

Shape 

4. Pricing Logic (Ex-Post, Local) 

Prices are never fixed upfront. After each interval closes, the oracle posts meter readings and the contract computes: 

𝑝𝑘𝑊ℎ[𝑡]=(local\_gen[𝑡]×𝑤1)+(battery\_delta[𝑡]×𝑤2)+(grid\_import[𝑡]×𝑝𝑠𝑝𝑜𝑡[𝑡])(total\_consumption[𝑡])×sharing\_key𝑐𝑜𝑛𝑠𝑢𝑚𝑒𝑟
p
k
W
h
[
t
]
=
(
local\_gen
[
t
]
×
w
1
)
+
(
battery\_delta
[
t
]
×
w
2
)
+
(
grid\_import
[
t
]
×
p
s
p
o
t
[
t
]
)
(
total\_consumption
[
t
]
)
×
sharing\_key
c
o
n
s
u
m
e
r
 
 

The three sharing key modes you can select per contract: 

STATIC — fixed % share per consumer (simplest, good for cooperatives) 

DYNAMIC — real-time proportion of each consumer's demand vs total REC demand (fairest) 

PRIORITY — rule-based first allocation (e.g., vulnerable households, EV charging windows) 

After the fact means: during the interval, the physical electrons flow. At minute 15, the oracle reports. The contract then settles — never before. This is legally clean because it mirrors how EU balancing markets actually work.[6] 

Shape 

5. Product Types (the Contract "Radio Buttons") 

Primary Product Types (select exactly one) 

A) ENERGY_DELIVERY — the standard nanoPPA 

Unit: kWh/interval, price: ex-post local 

Required: quantity_kwh_interval, delivery_point_id, meter_id_producer, meter_id_consumer, price_formula_ref, sharing_key_type 

B) ENERGY_FLEXIBILITY — for DSO/BRP services 

Unit: kW available capacity, kWh dispatched on signal 

Trigger: DSO congestion oracle OR BRP imbalance signal 

Required: flex_capacity_kw, activation_price_eur_kwh, response_time_min, max_duration_hours, flex_direction (enum: UP / DOWN / BOTH), activation_oracle_address, dso_party_id 

C) ENERGY_REDUCTION — ESCO-style savings contract 

Unit: kWh saved vs baseline per interval 

Required: baseline_kwh_profile (IPFS hash of agreed baseline), measurement_period, saving_split_pct_consumer, saving_split_pct_aggregator, baseline_verification_method (enum: METER / MODEL / HYBRID) 

Settlement: aggregator receives their % of savings in EUROC automatically each interval 

D) GRANULAR_GOO — EnergyTag-compliant certificate 

1 GC = 1 MWh of renewable energy, time-stamped to its 15-minute production interval[7] 

The EnergyTag Scheme Standard V2 (Dec 2024) defines issuance from validated meter data, unique certificate IDs, and registry transfer[7] 

Hypha Energy integration: Hypha acts as GC Issuer by connecting to national DataHub (like Energinet's model ) via API; on-chain token holds a pointer to the registry cancellation record[8] 

Required: goo_registry_domain, technology_type, production_start, production_end, cert_quantity_mwh, registry_transfer_ref, energytag_scheme_version 

E) AVOIDED_CARBON_CREDITS — voluntary market 

Unit: tCO2e avoided vs grid emission factor 

Standard: VERRA_VCS / GOLD_STANDARD / EU_VOLUNTARY (enum) 

Required: baseline_ef_gco2_kwh, avoided_co2_t, credit_standard, verification_body, registry_address_buyer 

Add-on Options (combine freely with any primary type) 

Add-on 

Bool flag 

Extra required fields 

INCLUDE_GRID_COSTS 

bool 

grid_tariff_code, tariff_eur_kwh, tariff_period 

INCLUDE_VAT 

bool 

vat_rate_pct, vat_jurisdiction 

INCLUDE_ENERGY_TAX 

bool 

energy_tax_rate_eur_kwh, tax_jurisdiction, tax_exemption_rec (bool — many NL/PT/ES REC members are exempt) 

 

Shape 

6. Settlement Flow (per 15-min interval) 

T+0:00  → Physical electrons flow (grid, sub-second) 
T+15:00 → Oracle posts: 
           producer_kwh[t], consumer_kwh[t], 
           grid_import[t], grid_export[t], battery_delta[t] 
T+15:01 → Contract computes allocated_kwh per consumer 
           using sharing_key logic 
T+15:02 → Contract computes price_kwh[t] using price_formula 
T+15:03 → Financial settlement executes: 
           Consumer → Producer (EUROC/EURe) 
           Aggregator fee deducted automatically 
T+15:04 → Optional: GC micro-certificate minted (if GRANULAR_GOO add-on) 
T+15:05 → All values written immutably on-chain 
 

Missing meter fallback: if oracle data is absent for interval t, the contract uses last_known_good_kwh[t-1] as estimated value, flags estimated = true, and queues for dispute if 3+ consecutive intervals are missing. 

Shape 

7. Legal Validation Flags 

On-chain require() checks at contract creation: 

Flag 

Rule 

Consequence if violated 

CAPACITY_LIMIT 

≤5 MW (ES/NO industrial), ≤500 kWp (NL SCE) 

Reject creation 

MEMBER_CHECK 

Consumer must be REC member/shareholder or collective self-consumer 

Reject creation 

ENTITY_TYPE 

entity_type ≠ LARGE_ENTERPRISE (RED II Art. 2(16)) unless national law permits 

Reject or emit warning 

TECHNOLOGY_RESTRICTION 

Some rules (Spain RD 244/2019) apply PV-only; validate technology_type 

Reject if tech mismatch 

BRP_NOMINATED 

BRP party must be named 

Reject creation 

DSO_NOTIFIED 

PT and others require formal sharing-key communication to DSO 

Warning flag; dso_notified (bool) + dso_notification_date 

NON_COMMERCIAL_PURPOSE 

REC purpose must be social/environmental first 

Store rec_purpose_statement; no auto-reject but auditable 

SUPPLY_LICENCE_EXEMPT 

NL: supply ≤ generation AND ≤ member ceiling 

Warning flag if ceiling not yet set by ministerial regulation [1] 

 

Shape 

8. Token Standard Recommendation: ERC-3643 

This is the right choice for nanoPPA, and here is why, compared simply: 

Feature 

ERC-20 + whitelist 

ERC-721 (NFT) 

ERC-3643 (T-REX) 

Compliance built-in 

❌ Manual 

❌ None 

✅ Native KYC/AML/identity [9] 

Geographic restriction modules 

❌ Custom code 

❌ No 

✅ Compliance modules [10] 

Identity registry (ONCHAINID) 

❌ No 

❌ No 

✅ Yes [11] 

REC membership validation 

❌ Manual 

❌ No 

✅ On-chain identity attributes 

ERC-20 compatible 

✅ Yes 

❌ No 

✅ Yes (backwards compatible) [9] 

Unique per contract 

❌ Fungible 

✅ Yes 

✅ Yes (each nanoPPA = unique token) 

Regulatory fit (MiCAR, RED II) 

Weak 

Weak 

✅ Strong [12] 

 

Conclusion: ERC-3643 gives you permissioned uniqueness (each nanoPPA is a distinct contract between specific parties), built-in compliance modules you can configure per country (distance, capacity, membership), and ONCHAINID identity binding — so only verified REC members can hold or trigger contracts. It is also ERC-20 compatible, so wallets and DEXes can read it.[9][12] 

Shape 

9. Stablecoin: EURe (Monerium) as primary, EUROC as fallback 

 

EUROC (Circle) 

EURe (Monerium) 

MiCA compliant 

Partial (pre-MiCA design) 

✅ Full MiCAR e-money token 

Chains 

Ethereum, Avalanche, Solana 

Ethereum, Gnosis, Polygon, Optimism 

IBAN linkage 

❌ No 

✅ Yes — linked to real bank IBAN 

Instant SEPA settlement 

❌ No 

✅ Yes 

Energy community fit 

Adequate 

✅ Better (real IBAN = DSO/utility billing compatible) 

 

EURe is preferred because it is a fully MiCAR-compliant electronic money token with SEPA/IBAN backing, which means DSOs and utilities can receive it just like a normal bank transfer — critical for the Netherlands and Portugal where DSOs are involved in settlement.[13] 

Shape 

10. Oracle Infrastructure 

Three meter data sources, in priority order: 

P4 smart meter (DSO-certified, push every 15 min via DSO DataHub API) — most authoritative, used in NL/PT/NO; Hypha Energy registers as a certified data recipient 

P1/HAN sensor (consumer-side, local reading of smart meter data port, push to Hypha gateway) — good for ES/PT where DSO API access is slow; slightly less authoritative but fast 

Own smart meter (producer-side generation meter, certified by grid operator) — for the producer's generation reading; always required 

On-chain delivery: readings go through a Chainlink DON (Decentralized Oracle Network) or equivalent, which aggregates multiple data sources and posts a cryptographically signed 15-min data point. If two sources disagree by >2%, the dispute flag activates. 

Shape 

11. Dispute Resolution (Cooperative Principles) 

Disputes are resolved in three escalating steps: 

Step 1 — Automatic (0–48h): smart contract uses estimated_kwh fallback based on last 7-day average for that consumer/producer pair. No human involved. 

Step 2 — Cooperative Arbitration Panel (48h–30 days): if disputed, a 3-person panel convenes: 

1 arbiter nominated by CONSUMER (from verified REC member pool) 

1 arbiter nominated by PRODUCER (same pool) 

1 independent arbiter (Hypha Energy holds a pre-approved list; defaults to REScoop.eu mediator pool) 

Panel rules: majority decision within 30 days; decision is posted on-chain and triggers contract adjustment. This mirrors cooperative democratic principles — no single party controls the outcome. 

Step 3 — National Legal Jurisdiction (>30 days): binding arbitration under the governing law of legal_jurisdiction field. Contract stores arbitration_seat (city) and governing_law_code (ISO country). 

Shape 

12. Solidity Struct (JSON Schema) 

struct NanoPPA { 
 
  // IDENTITY 
  bytes32 contract_id;                  // REQUIRED — keccak256 unique hash 
  uint256 created_at;                   // REQUIRED — Unix timestamp 
  string  version;                      // REQUIRED — e.g. "nanoPPA-1.0" 
 
  // PARTIES 
  address producer_wallet;              // REQUIRED 
  address consumer_wallet;              // REQUIRED 
  address aggregator_wallet;            // REQUIRED (Hypha Energy) 
  address dso_wallet;                   // CONDITIONAL (FLEX only) 
  address brp_wallet;                   // CONDITIONAL (if ≠ aggregator) 
  address other_rec_wallet;             // CONDITIONAL (REC-REC trade) 
 
  bytes32 producer_meter_id;            // REQUIRED (EAN/EIC) 
  bytes32 consumer_meter_id;            // REQUIRED 
  string  producer_entity_type;         // REQUIRED (enum: INDIVIDUAL/SME/COOP/LARGE_ENTERPRISE) 
  string  consumer_entity_type;         // REQUIRED 
 
  // GEOGRAPHY & COMPLIANCE 
  string  country_code;                 // REQUIRED (ISO 3166-1 alpha-2) 
  string  voltage_level;                // REQUIRED (enum: LV/MV/HV/EHV) 
  int256  gps_lat_producer;             // REQUIRED (×1e6 fixed point) 
  int256  gps_lon_producer;             // REQUIRED 
  int256  gps_lat_consumer;             // REQUIRED 
  int256  gps_lon_consumer;             // REQUIRED 
  bool    distance_validated;           // REQUIRED — set by oracle at creation 
  bool    member_validated;             // REQUIRED — REC membership confirmed 
  bool    brp_nominated;                // REQUIRED 
  bool    dso_notified;                 // CONDITIONAL (PT and others) 
  uint256 dso_notification_date;        // CONDITIONAL 
 
  // INTERVAL & SETTLEMENT 
  uint8   interval_minutes;             // REQUIRED (default: 15) 
  bool    hourly_fallback;              // CONDITIONAL (Spain legacy meters) 
  string  legal_basis_interval;         // OPTIONAL 
 
  // PRODUCT TYPE 
  string  product_type;                 // REQUIRED (enum: ENERGY_DELIVERY / 
                                        // ENERGY_FLEXIBILITY / ENERGY_REDUCTION / 
                                        // GRANULAR_GOO / AVOIDED_CARBON_CREDITS) 
  string  sharing_key_type;             // REQUIRED (enum: STATIC/DYNAMIC/PRIORITY) 
  uint256 sharing_key_value;            // REQUIRED (×1e4 basis points) 
  string  price_formula_ref;            // REQUIRED (IPFS hash of formula params) 
 
  // PRODUCT-SPECIFIC (CONDITIONAL) 
  uint256 flex_capacity_kw;             // CONDITIONAL (FLEX) 
  uint256 activation_price_eur_kwh;     // CONDITIONAL (FLEX) ×1e6 
  uint8   response_time_min;            // CONDITIONAL (FLEX) 
  string  flex_direction;               // CONDITIONAL (UP/DOWN/BOTH) 
  bytes32 activation_oracle_address;    // CONDITIONAL (FLEX) 
 
  bytes32 baseline_ipfs_hash;           // CONDITIONAL (REDUCTION) 
  uint256 saving_split_pct_consumer;    // CONDITIONAL (REDUCTION) ×100 
  uint256 saving_split_pct_aggregator;  // CONDITIONAL (REDUCTION) ×100 
 
  string  goo_registry_domain;          // CONDITIONAL (GOO) 
  string  technology_type;              // CONDITIONAL (GOO + some national rules) 
  bytes32 energytag_scheme_version;     // CONDITIONAL (GOO) 
 
  uint256 baseline_ef_gco2_kwh;         // CONDITIONAL (CARBON) ×1e4 
  string  credit_standard;             // CONDITIONAL (CARBON) 
  string  verification_body;           // CONDITIONAL (CARBON) 
  address registry_address_buyer;       // CONDITIONAL (CARBON) 
 
  // ADD-ONS 
  bool    include_grid_costs;           // OPTIONAL 
  uint256 grid_tariff_eur_kwh;          // CONDITIONAL ×1e6 
  bool    include_vat;                  // OPTIONAL 
  uint256 vat_rate_pct;                 // CONDITIONAL ×100 
  bool    include_energy_tax;           // OPTIONAL 
  uint256 energy_tax_rate_eur_kwh;      // CONDITIONAL ×1e6 
  bool    tax_exemption_rec;            // CONDITIONAL 
 
  // SETTLEMENT TOKEN 
  address stablecoin_address;           // REQUIRED (EURe default) 
 
  // LEGAL 
  string  governing_law_code;           // REQUIRED (ISO country) 
  string  arbitration_seat;             // REQUIRED (city) 
  string  rec_purpose_statement;        // OPTIONAL (auditable, non-commercial) 
 
  // STATUS 
  string  status;                       // REQUIRED (enum: PENDING/ACTIVE/SUSPENDED/TERMINATED) 
  uint256 termination_date;             // CONDITIONAL 
  string  termination_reason;           // CONDITIONAL 
} 
 

Shape 

13. On-Chain Events 

event ContractCreated( 
  bytes32 indexed contract_id, 
  address producer, 
  address consumer, 
  string  jurisdiction, 
  string  product_type, 
  uint256 timestamp 
); 
 
event IntervalSettled( 
  bytes32 indexed contract_id, 
  uint256 interval_start,       // Unix timestamp of interval open 
  uint256 kwh_delivered_e4,     // ×10000 for 4 decimal precision 
  uint256 eur_settled_e6,       // ×1000000 (micro-euro precision) 
  bool    estimated             // true if oracle fallback was used 
); 
 
event CertificateIssued( 
  bytes32 indexed contract_id, 
  bytes32 goo_id,               // EnergyTag certificate unique ID 
  uint256 mwh_e4,               // ×10000 
  uint256 production_timestamp, 
  string  registry_domain 
); 
 
event DisputeRaised( 
  bytes32 indexed contract_id, 
  uint256 interval_start, 
  address raised_by, 
  string  reason 
); 
 
event DisputeResolved( 
  bytes32 indexed contract_id, 
  uint256 adjusted_kwh_e4, 
  uint256 adjusted_eur_e6, 
  string  resolution_method    // AUTO / PANEL / LEGAL 
); 
 
event ContractTerminated( 
  bytes32 indexed contract_id, 
  string  reason, 
  uint256 final_settlement_eur_e6 
); 
 

Shape 

Open Questions: Resolved 

# 

Question 

Resolution 

1 

Oracle / meter data 

P4 (DSO certified) → P1/HAN (consumer-side) → Producer meter, delivered via Chainlink DON; Hypha registers as data recipient per country DSO rules 

2 

Stablecoin 

EURe (Monerium) primary (MiCAR-compliant, IBAN-linked, SEPA-compatible); EUROC as fallback for chains where EURe is unavailable 

3 

Token standard 

ERC-3643 — permissioned, compliance modules for REC rules, ONCHAINID identity binding, ERC-20 backward compatible [9][12] 

4 

Dispute resolution 

3-step: auto-estimate → cooperative panel (1 consumer + 1 producer + 1 independent arbiter) → national jurisdiction 

5 

EnergyTag/GOO API 

Hypha Energy operates as a GC Issuer under EnergyTag Scheme Standard V2 [7], connecting to national DataHub APIs (modelled on Energinet's live scheme [8]); on-chain token stores registry transfer reference 

 

⁂ 

Shape 

https://www.rescoop.eu/policy/transposition-tracker/enabling-frameworks-support-schemes/netherlands    

https://www.otcextremadura.org/espana-amplia-de-2km-a-5km-el-radio-de-autoconsumo-colectivo   

https://chambers.com/articles/portugal-new-legal-framework-of-the-sen-decree-law-no-15-2022-of-14-january-self-consumption-2   

https://qgmlaw.com/publications/dutch-energy-act-passed-by-senate/  

https://www.pv-magazine.com/2025/07/03/norway-introduces-fiscal-incentives-for-commercial-industrial-energy-communities/  

https://www.ree.es/en/press-office/news/press-release/2022/05/red-electrica-will-adapt-operation-schedule-peninsular-electricity-system-into-15-minute-periods   

https://energytag.org/wp-content/uploads/2024/12/EnergyTag_Granular-Certificate-Scheme-Standard-V2.pdf    

https://energytag.org/wp-content/uploads/2025/09/Energinet_GC-Scheme_protocol.pdf   

https://docs.erc3643.org     

https://docs.erc3643.org/erc-3643/overview-of-the-protocol/built-in-compliance-framework  

https://docs.erc3643.org/erc-3643  

https://www.nadcab.com/blog/real-estate-tokenization-standards-comparison    

https://nedzero.nl/en/news/the-new-energy-law-what-is-it-about  

https://www.rescoop.eu/uploads/rescoop/downloads/SCCALE-Policy-recommendations.pdf  

https://www.rescoop.eu/uploads/rescoop/downloads/D4.1-Regulatory-and-Legal-Frameworks_FIN_2023.01.13.pdf  

https://www.rescoop.eu/policy/financing-tracker/repowereu-tracker/netherlands-repowereu  

https://www.rescoop.eu/uploads/rescoop/downloads/Collective-self-consumption-and-energy-communities.-Trends-and-challenges-in-the-transposition-of-the-EU-framework.pdf  

https://www.rescoop.eu/uploads/rescoop/downloads/Energy-Communities-Transposition-Guidance.pdf  

https://www.rescoop.eu/uploads/rescoop/downloads/EPBD-Policy-Briefing-2nd-Generation-of-Energy-Communities-Legislation.pdf  

https://www.rescoop.eu/uploads/rescoop/downloads/Dutch-Community-Energy-Guide.pdf  

https://docs.erc3643.org/erc-3643/overview/built-in-compliance-framework  

https://www.rescoop.eu/uploads/Energy-communities_version-4-1.pdf  

https://docs.erc3643.org/erc-3643/smart-contracts-library/compliance-management  

https://www.rescoop.eu/toolbox/second-generation-eu-legislation-for-energy-communities  

https://kvdl.com/en/articles/de-energiewet-wat-verandert-er-vanaf-2026  

https://www.government.nl/binaries/government/documenten/reports/2024/02/29/preventive-action-plan-2023-the-netherlands/Preventive+Action+Plan+2023+The+Netherlands.pdf  

https://practiceguides.chambers.com/practice-guides/renewable-energy-2025/netherlands/trends-and-developments  

https://publications.enexis.nl/annual-report/annual-report-2023/report/together-towards-a-futureproof-energy-system/laws-and-regulations-in-the-energy-transition  

https://store.aicerts.ai/blog/erc-3643-the-legal-framework-powering-compliant-nft-development/  

https://www.bpie.eu/wp-content/uploads/2023/04/FACTSHEET_Netherlands_3.pdf  

https://www.axiomrecruit.com/resources/industry-insights/real-world-asset-tokenisation--erc-3643-vs-nfts-for-businesses/  

https://www.granular-energy.com/insights/guide-to-the-emerging-hourly-matching-standards  

https://pub.norden.org/nordicenergyresearch2023-03/netherlands.html  

https://www.linkedin.com/pulse/understanding-ethereum-token-standards-erc-20-erc-3643-aman-vaths-lonac  

 

PROMPT: 

You are a technical and legal expert in EU renewable energy communities (RECs), 

EVM smart contracts, and energy market design. 

Help me define a nanoPPA — a minimalist, standardized Power Purchase 
Agreement encoded as a token in an EVM smart contract. It represents 
a bilateral energy contract between a PRODUCER and a CONSUMER, 
always operating within the rules of national REC legislation. 

Shape 

1. PARTIES IN THE CONTRACT 

The nanoPPA always includes these roles: 

PRODUCER: the party generating renewable energy (individual, cooperative, SME) 

CONSUMER: the party consuming energy (individual, SME, tenant, EV charger) 

AGGREGATOR (Hypha Energy): platform operator, acts as settlement agent, 
balancing responsible party (BRP) coordinator, and optional DSO interface 

[OPTIONAL] DSO: distribution system operator, included only when physical 
grid services (flexibility, congestion) are contracted 

[OPTIONAL] BRP: balance responsible party, only if a separate party from 
aggregator 

[OPTIONAL] OTHER_REC: another energy community acting as counter-party 
(peer-to-peer between RECs) 

For each party, store: wallet_address, role_enum, legal_jurisdiction, 
meter_id (EAN/EIC code), signing_key. 

Shape 

2. NATIONAL REC RULES (GEOGRAPHICAL CONSTRAINTS) 

The nanoPPA must validate the distance between PRODUCER and CONSUMER 
against the active national rule. Use these as the reference set: 

Country 

Max distance / rule 

Legal basis 

Notes 

Spain 

5 km (default); 500 m within same LV substation 

RDL 7/2025 (June 2025) 

Was 2 km until June 2025; still 500m for some 

Portugal 

<2 km (LV / low density urban); 4 km (MV); 10 km (HV); 

DL 15/2022 + 2025 amendment 

Distance is voltage-level based, not 

 

20 km (EHV); same substation = no limit 

 

strictly urban/rural 

Netherlands 

Make sure you use the 2026 rules + future changes (all country can be part of the energy community) not the 'adjacent postcode zone (SCE regeling, since 2021) ' this will disappear soon 

New Energy Act 

country wide 

Norway 

Same property OR same commercial/industrial area (≤5 MW PV) 

Revised budget 2024/2025 

Residential housing coop: same building only; 

 

 

(effective July 2025) 

Urban C&I buildings NOT eligible 

EU default 

Proximity to be defined by Member State (RED II Art. 22) 

RED II 2018/2001 

Falls back to national rule 

 

CORRECTION NOTE for prompt user: 

Spain is now 5 km (not 2 km) since RDL 7/2025 

Portugal's 2 km / 4 km split is LV vs MV voltage-based, not city vs countryside 

Netherlands is nationwide — postcode-zone proximity is phased our 

Norway has no explicit km limit; it is property/area-based 

The smart contract must: 
a) Store: country_code, connection_voltage_level (LV/MV/HV/EHV), 
gps_coordinates_producer, gps_coordinates_consumer 
b) Validate on-chain OR by oracle: distance ≤ national limit for the voltage level 
c) Reject contract creation if distance rule is violated 

Shape 

3. SETTLEMENT INTERVAL 

Default: 15-minute interval (EU-wide standard, EU Regulation 2017/2195, 
mandatory since January 2021). 

CORRECTION NOTE: 

Spain adopted 15-minute ISP for grid balancing (REE, May 2022). 
Consumer-facing PVPC tariffs are still published hourly. For REC settlement, 
use 15-minute by default; flag hourly_fallback = true if national 
settlement data is only available hourly for the specific Spanish meter type. 

Store: interval_minutes (default: 15), hourly_fallback (bool), 
legal_basis_interval (string) 

Physical delivery is sub-second (real-time grid flow). 
Financial settlement is post-facto at the end of each 15-minute interval. 
Physical delivery DEFINES the financial settlement — prices are always 
calculated "after the fact" (ex-post), not pre-agreed fixed prices. 

Shape 

4. PRICING LOGIC (EX-POST, LOCAL) 

Prices are NEVER fixed upfront. They are always computed after each interval 
from local conditions: 

price_kwh = f( 
local_generation_kwh, // from PRODUCER meter 
battery_state_kwh, // if storage is present in REC 
grid_import_kwh, // from DSO meter 
grid_export_kwh, // to DSO meter 
spot_price_reference, // day-ahead EPEX/OMIE/APX price 
sharing_key // dynamic coefficient assigned to each CONSUMER 
) 

The sharing key (coefficient) can be: 

STATIC: fixed % share per consumer (simple) 

DYNAMIC: real-time proportion of each consumer's actual demand vs total demand 

PRIORITY: rule-based (e.g., vulnerable households get first allocation) 

Shape 

5. CONTRACT PRODUCT TYPES (RADIO BUTTONS IN UI) 

Each nanoPPA token must have exactly ONE primary product type selected, 
plus optional add-ons. Define all as enum fields: 

PRIMARY PRODUCT TYPE (select one): 

A) ENERGY_DELIVERY 

Unit: kWh per 15-min interval 

Price: ex-post local price (see §4) 

Settlement: net metered kWh delivered from producer to consumer 

Required fields: quantity_kwh_interval, delivery_point_id, 
meter_id_producer, meter_id_consumer, price_formula_ref 

B) ENERGY_FLEXIBILITY 

For contracts involving DSO, BRP, or other RECs/prosumers 

Unit: kW (power capacity available), kWh dispatched 

Trigger: DSO congestion signal OR BRP imbalance request 

Parties: must include DSO or BRP role 

Required fields: flex_capacity_kw, activation_price_eur_kwh, 
response_time_minutes, max_duration_hours, flex_direction 
(up/down/both), activation_oracle_address 

C) ENERGY_REDUCTION (ESCO-style) 

Supplier/aggregator receives a share of financial or kWh savings 
vs a baseline consumption profile 

Unit: kWh saved per interval vs baseline 

Settlement: split between CONSUMER and AGGREGATOR per agreed ratio 

Required fields: baseline_kwh_profile, measurement_period, 
saving_split_pct_consumer, saving_split_pct_aggregator, 
baseline_verification_method (meter/model/hybrid) 

D) GRANULAR_GOO (Granular Guarantee of Origin / REC certificate) 

1 certificate = 1 MWh of proven renewable origin, time-stamped 
to the 15-min production interval (granular GOO per EnergyTag standard) 

Registry: national registry (REGOS/AIB EECS domain) 

Transfer: on-chain pointer to registry cancellation/transfer record 

Required fields: goo_registry_domain, technology_type, 
production_start_datetime, production_end_datetime, 
certificate_quantity_mwh, registry_transfer_ref 

E) AVOIDED_CARBON_CREDITS (voluntary market) 

Based on EU voluntary carbon market frameworks 

Unit: tCO2e avoided per contract period 

Standard: Verra VCS / Gold Standard / EU voluntary (as applicable) 

Settlement: credits issued to buyer's registry address 

Required fields: baseline_emissions_factor_gco2_kwh, 
avoided_co2_tonnes, credit_standard, verification_body, 
registry_address_buyer 

ADD-ON OPTIONS (can combine with any primary type): 

INCLUDE_GRID_COSTS (bool): add DSO tariff component to settlement 

fields: grid_tariff_code, tariff_eur_kwh, tariff_period 

INCLUDE_VAT (bool): apply national VAT rate 

fields: vat_rate_pct, vat_jurisdiction 

INCLUDE_ENERGY_TAX (bool): apply national energy/excise tax 

fields: energy_tax_rate_eur_kwh, tax_jurisdiction, tax_exemption_recs 
(many REC members in NL/PT/ES have partial or full exemptions) 

Shape 

6. PHYSICAL vs FINANCIAL SETTLEMENT ALIGNMENT 

Physical delivery (real-time kWh flow on the grid) and financial settlement 
(EUR/token amount per interval) must always be reconciled in the same 
15-minute cycle. 

Settlement flow per interval: 

Meter oracle posts: producer_kwh[t], consumer_kwh[t], 
grid_import[t], grid_export[t], battery_delta[t] 

Smart contract computes: allocated_kwh_per_consumer[t] 
using sharing_key logic 

Smart contract computes: price_per_kwh[t] using price_formula 

Financial settlement is executed: consumer pays producer 
(via stablecoin e.g. EUROC), aggregator fee deducted 

Optional: GOO micro-certificate minted for each MWh block 

All values are immutable on-chain after settlement. Disputes use 
last_known_good_meter_reading and estimated_kwh fallback rules. 

Shape 

7. ADDITIONAL LEGAL LIMITATIONS TO FLAG (beyond distance) 

Include validation / warning flags in the contract for: 

CAPACITY LIMIT: most national REC rules cap the producer installation 
at ≤5 MW (Spain, Norway industrial), ≤500 kWp (NL SCE for PV) 

MEMBERSHIP LIMIT: consumer must be a member/shareholder of the REC 
(nearly universal EU requirement) or slef consumption collective 

OWNERSHIP/CONTROL: large enterprises may be excluded from RECs 
(RED II Art. 2(16)); validate entity_type ≠ LARGE_ENTERPRISE 
unless national law permits 

GRID VOLTAGE: some sharing rules are restricted to LV network only 
(e.g., original Spain 500m rule was LV-only) 

TECHNOLOGY RESTRICTION: some frameworks apply only to PV 
(Spain RD 244/2019); store technology_type and validate 

NO COMMERCIAL PURPOSE AS PRIMARY AIM: REC purpose must be 
primarily social/environmental, not profit. Store rec_purpose_statement 

BALANCING RESPONSIBILITY: in most countries, someone must be 
nominated as BRP; contract must name BRP_party_id 

SHARING KEY NOTIFICATION: in Portugal and some others, the sharing 
key must be formally communicated to the DSO. Store 
dso_notified (bool), dso_notification_date 

SUPPLY LICENSE EXEMPTION: check if aggregator needs a supply licence 
(NL: exempt if annual supply ≤ annual generation AND ≤ X members) 

Shape 

8. TOKEN DATA STRUCTURE SUMMARY 

Produce a Solidity-compatible struct (or JSON schema) containing all 
mandatory and optional fields described above. Mark fields as: 

REQUIRED (always present, validation fails without it) 

CONDITIONAL (required only if a certain product_type or add-on is selected) 

OPTIONAL (informational, stored but not validated on-chain) 

Also define the on-chain events emitted: 

ContractCreated(contract_id, producer, consumer, jurisdiction, product_type) 

IntervalSettled(contract_id, interval_start, kwh_delivered, eur_settled) 

CertificateIssued(contract_id, goo_id, mwh, timestamp) 

ContractTerminated(contract_id, reason, final_settlement) 

Shape 

9. CONSTRAINTS & OPEN QUESTIONS TO RESOLVE 

Please flag these open items in your output: 

The oracle infrastructure that provides tamper-proof 15-min meter data: or smartmeter (p4) or own meter (p1/han sensor) or own smartmeter (consumer side) 

stablecoin is used for settlement = EUROC or EURe 

Research what is best: standalone ERC-20 token with whitelisting, ERC-721 NFT (unique contract), or ERC-3643 (permissioned security token with identity compliance)? 

Add disputes resulition in line with cooperative principles (eg arbitration with 1 consumer arbiter, 1 producer arbiter + 1 independent) when meter data is missing or contested? 

Add Hypha Energy that supports API-based granular GOO transfer (energytag foundation setup)? 