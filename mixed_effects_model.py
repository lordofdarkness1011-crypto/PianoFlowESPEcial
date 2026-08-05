import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

# 1. Load data
df_http = pd.read_csv('resultados_latencia_http.csv')
df_ws = pd.read_csv('resultados_latencia_ws.csv')

# 2. Add protocol column
df_http['protocol'] = 'HTTP'
df_ws['protocol'] = 'WS'

# 3. Combine datasets
df = pd.concat([df_http, df_ws], ignore_index=True)

# Filter for STEADY phase and valid latency (standard for this project)
df = df[(df['Fase'] == 'STEADY') & (df['Latencia_ms'] > 0)].copy()

# Ensure ClienteID is categorical/string so it's treated as a group properly
df['ClienteID'] = df['ClienteID'].astype(str)

print(f"Data loaded: {len(df)} total steady samples.")
print(df.groupby('protocol')['Latencia_ms'].mean())

# 4. Fit the linear mixed-effects model
# Latencia_ms is the dependent variable.
# protocol is the fixed effect.
# ClienteID is the random intercept (groups).
md = smf.mixedlm("Latencia_ms ~ C(protocol)", df, groups=df["ClienteID"])
mdf = md.fit()

# 5. Report results
print(mdf.summary())

# Extract specific requested numbers for easy reading
fixed_effect = mdf.params['C(protocol)[T.WS]']
se = mdf.bse['C(protocol)[T.WS]']
ci_low = mdf.conf_int().loc['C(protocol)[T.WS]'][0]
ci_high = mdf.conf_int().loc['C(protocol)[T.WS]'][1]
p_val = mdf.pvalues['C(protocol)[T.WS]']
group_var = mdf.cov_re.iloc[0,0]

print("\n--- EXACT REQUESTED NUMBERS ---")
print(f"Fixed effect coefficient for protocol (WS vs HTTP base): {fixed_effect:.4f}")
print(f"Standard error of the coefficient: {se:.4f}")
print(f"95% Confidence Interval: [{ci_low:.4f}, {ci_high:.4f}]")
print(f"p-value for protocol: {p_val:.4e}")
print(f"Random effect variance (ClienteID variance): {group_var:.4f}")

if not mdf.converged:
    print("\nWARNING: Model did not converge!")
else:
    print("\nModel converged successfully.")
